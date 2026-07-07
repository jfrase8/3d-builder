package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/jfras/3d-builder/internal/store"
)

type Handler struct {
	Store *store.Store
}

func (h *Handler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/structures", h.list)
	r.Post("/structures", h.create)
	r.Get("/structures/{id}", h.get)
	r.Put("/structures/{id}", h.update)
	r.Delete("/structures/{id}", h.delete)
	return r
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	items, err := h.Store.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	st, err := h.Store.Get(r.Context(), id)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	in, ok := decodeStructure(w, r)
	if !ok {
		return
	}
	st, err := h.Store.Create(r.Context(), in)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, st)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	in, ok := decodeStructure(w, r)
	if !ok {
		return
	}
	st, err := h.Store.Update(r.Context(), id, in)
	if handleStoreErr(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if handleStoreErr(w, h.Store.Delete(r.Context(), id)) {
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- helpers ---

func decodeStructure(w http.ResponseWriter, r *http.Request) (store.Structure, bool) {
	var in store.Structure
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return store.Structure{}, false
	}
	if in.GridX <= 0 {
		in.GridX = 16
	}
	if in.GridY <= 0 {
		in.GridY = 16
	}
	if in.Name == "" {
		in.Name = "Untitled"
	}
	if in.Blocks == nil {
		in.Blocks = []store.Block{}
	}
	return in, true
}

func parseID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeErr(w, http.StatusBadRequest, errors.New("invalid id"))
		return 0, false
	}
	return id, true
}

func handleStoreErr(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, store.ErrNotFound):
		writeErr(w, http.StatusNotFound, err)
	case errors.Is(err, store.ErrNameTaken):
		writeErr(w, http.StatusConflict, err)
	default:
		writeErr(w, http.StatusInternalServerError, err)
	}
	return true
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, err error) {
	writeJSON(w, code, map[string]string{"error": err.Error()})
}