package server

import (
	"fmt"
	"net/http"
	"net/url"

	"golang.org/x/net/context"

	"github.com/influxdata/chronograf"
	"github.com/influxdata/chronograf/oauth2"
)

type userLinks struct {
	Self string `json:"self"` // Self link mapping to this resource
}

type userResponse struct {
	*chronograf.User
	Links userLinks `json:"links"`
}

// If new user response is nil, return an empty userResponse because it
// indicates authentication is not needed
func newUserResponse(usr *chronograf.User) userResponse {
	base := "/chronograf/v1/users"
	name := "me"
	if usr != nil {
		// TODO: Change to usrl.PathEscape for go 1.8
		u := &url.URL{Path: usr.Name}
		name = u.String()
	}

	return userResponse{
		User: usr,
		Links: userLinks{
			Self: fmt.Sprintf("%s/%s", base, name),
		},
	}
}

func getEmail(ctx context.Context) (string, error) {
	principal, err := getPrincipal(ctx)
	if err != nil {
		return "", err
	}
	if principal.Subject == "" {
		return "", fmt.Errorf("Token not found")
	}
	return principal.Subject, nil
}

func getPrincipal(ctx context.Context) (oauth2.Principal, error) {
	principal, ok := ctx.Value(oauth2.PrincipalKey).(oauth2.Principal)
	if !ok {
		return oauth2.Principal{}, fmt.Errorf("Token not found")
	}

	return principal, nil
}

// Me does a findOrCreate based on the email in the context
func (h *Service) Me(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if !h.UseAuth {
		// If there's no authentication, return an empty user
		res := newUserResponse(nil)
		encodeJSON(w, http.StatusOK, res, h.Logger)
		return
	}

	email, err := getEmail(ctx)
	if err != nil {
		invalidData(w, err, h.Logger)
		return
	}

	usr, err := h.UsersStore.Get(ctx, email)
	if err == nil {
		res := newUserResponse(usr)
		encodeJSON(w, http.StatusOK, res, h.Logger)
		return
	}

	// Because we didnt find a user, making a new one
	user := &chronograf.User{
		Name: email,
	}

	newUser, err := h.UsersStore.Add(ctx, user)
	if err != nil {
		msg := fmt.Errorf("error storing user %s: %v", user.Name, err)
		unknownErrorWithMessage(w, msg, h.Logger)
		return
	}

	res := newUserResponse(newUser)
	encodeJSON(w, http.StatusOK, res, h.Logger)
}
