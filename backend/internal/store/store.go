package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// ErrNotFound is returned when a structure does not exist.
var ErrNotFound = errors.New("structure not found")

// ErrNameTaken is returned when a create/update would collide with another
// structure's name (case-insensitive). The API maps this to 409 Conflict.
var ErrNameTaken = errors.New("a build with that name already exists")

// Block is a single voxel at integer grid coordinates. Z is the stack height
// (0 = grid surface). Color is a hex string; omitted for legacy blocks.
type Block struct {
	X     int    `json:"x"`
	Y     int    `json:"y"`
	Z     int    `json:"z"`
	Color string `json:"color,omitempty"`
}

// Structure is a saved creation. Blocks are stored as a JSON array in SQLite.
type Structure struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	GridX     int       `json:"gridX"`
	GridY     int       `json:"gridY"`
	Blocks    []Block   `json:"blocks"`
	UpdatedAt time.Time `json:"updatedAt"`
	CreatedAt time.Time `json:"createdAt"`
}

type Store struct {
	db *sql.DB
}

func Open(dsn string) (*Store, error) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// modernc driver is single-connection friendly; enable WAL for concurrent reads.
	if _, err := db.Exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`); err != nil {
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) migrate() error {
	if _, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS structures (
			id         INTEGER PRIMARY KEY AUTOINCREMENT,
			name       TEXT NOT NULL DEFAULT 'Untitled',
			grid_x     INTEGER NOT NULL DEFAULT 16,
			grid_y     INTEGER NOT NULL DEFAULT 16,
			blocks     TEXT NOT NULL DEFAULT '[]',
			created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`); err != nil {
		return err
	}

	// An existing DB from before the uniqueness constraint may hold
	// case-insensitive duplicate names; suffix them so the unique index can be
	// created. Keeps the oldest row's name, renames the rest to "name (n)".
	if err := s.dedupeNames(); err != nil {
		return err
	}

	// Enforce case-insensitive name uniqueness at the DB level.
	_, err := s.db.Exec(
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_structures_name_nocase
		 ON structures (name COLLATE NOCASE);`)
	return err
}

// dedupeNames rewrites any case-insensitive duplicate names to unique
// "name (n)" variants, keeping the lowest id (oldest) untouched. Run once
// before the unique index is created.
func (s *Store) dedupeNames() error {
	rows, err := s.db.Query(`SELECT id, name FROM structures ORDER BY id`)
	if err != nil {
		return err
	}
	type row struct {
		id   int64
		name string
	}
	var all []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.name); err != nil {
			rows.Close()
			return err
		}
		all = append(all, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	seen := make(map[string]bool, len(all))
	for _, r := range all {
		key := strings.ToLower(strings.TrimSpace(r.name))
		if !seen[key] {
			seen[key] = true
			continue
		}
		fixed := uniqueNameFrom(r.name, seen)
		if _, err := s.db.Exec(`UPDATE structures SET name = ? WHERE id = ?`, fixed, r.id); err != nil {
			return err
		}
		seen[strings.ToLower(fixed)] = true
	}
	return nil
}

func (s *Store) List(ctx context.Context) ([]Structure, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, name, grid_x, grid_y, blocks, created_at, updated_at
		 FROM structures ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Structure{}
	for rows.Next() {
		st, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, st)
	}
	return out, rows.Err()
}

func (s *Store) Get(ctx context.Context, id int64) (Structure, error) {
	row := s.db.QueryRowContext(ctx,
		`SELECT id, name, grid_x, grid_y, blocks, created_at, updated_at
		 FROM structures WHERE id = ?`, id)
	st, err := scan(row)
	if errors.Is(err, sql.ErrNoRows) {
		return Structure{}, ErrNotFound
	}
	return st, err
}

func (s *Store) Create(ctx context.Context, in Structure) (Structure, error) {
	blob, err := json.Marshal(in.Blocks)
	if err != nil {
		return Structure{}, err
	}
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO structures (name, grid_x, grid_y, blocks) VALUES (?, ?, ?, ?)`,
		in.Name, in.GridX, in.GridY, string(blob))
	if isUniqueViolation(err) {
		return Structure{}, ErrNameTaken
	}
	if err != nil {
		return Structure{}, err
	}
	id, _ := res.LastInsertId()
	return s.Get(ctx, id)
}

// Update overwrites an existing structure. Returns ErrNotFound if the id is unknown.
func (s *Store) Update(ctx context.Context, id int64, in Structure) (Structure, error) {
	blob, err := json.Marshal(in.Blocks)
	if err != nil {
		return Structure{}, err
	}
	res, err := s.db.ExecContext(ctx,
		`UPDATE structures
		 SET name = ?, grid_x = ?, grid_y = ?, blocks = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ?`,
		in.Name, in.GridX, in.GridY, string(blob), id)
	if isUniqueViolation(err) {
		return Structure{}, ErrNameTaken
	}
	if err != nil {
		return Structure{}, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return Structure{}, ErrNotFound
	}
	return s.Get(ctx, id)
}

func (s *Store) Delete(ctx context.Context, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM structures WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

var suffixRe = regexp.MustCompile(`\s*\(\d+\)\s*$`)

// uniqueNameFrom returns desired if its lowercased form is not in taken,
// otherwise the first free "base (n)", where base is desired with a trailing
// " (n)" stripped. Mirrors the frontend uniqueName so both agree.
func uniqueNameFrom(desired string, taken map[string]bool) string {
	if !taken[strings.ToLower(strings.TrimSpace(desired))] {
		return desired
	}
	base := strings.TrimSpace(suffixRe.ReplaceAllString(desired, ""))
	for n := 1; ; n++ {
		cand := fmt.Sprintf("%s (%d)", base, n)
		if !taken[strings.ToLower(cand)] {
			return cand
		}
	}
}

// isUniqueViolation reports whether err is a SQLite UNIQUE constraint failure.
func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}

// scanner abstracts *sql.Row and *sql.Rows so scan works for both.
type scanner interface {
	Scan(dest ...any) error
}

func scan(sc scanner) (Structure, error) {
	var st Structure
	var blob string
	if err := sc.Scan(&st.ID, &st.Name, &st.GridX, &st.GridY, &blob, &st.CreatedAt, &st.UpdatedAt); err != nil {
		return Structure{}, err
	}
	if err := json.Unmarshal([]byte(blob), &st.Blocks); err != nil {
		return Structure{}, err
	}
	if st.Blocks == nil {
		st.Blocks = []Block{}
	}
	return st, nil
}
