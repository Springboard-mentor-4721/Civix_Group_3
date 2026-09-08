# CIVIX — Frontend

> **Your Voice. Your City.**
> Angular 21 frontend for the CIVIX civic engagement platform.

---

## Tech Stack

| Tool | Version |
|------|---------|
| Angular | 21.2.22 |
| Angular CLI | 21.2.22 |
| TypeScript | 5.9.3 |
| RxJS | ~7.8.0 |
| Vitest | ^4.0.8 |
| Node (recommended) | 18+ |
| npm | 10.9.8 |

---

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── auth/
│   │   │   ├── login/
│   │   │   │   ├── login.ts          # Login component
│   │   │   │   ├── login.html        # Login page template
│   │   │   │   └── login.css         # @import from register.css
│   │   │   ├── register/
│   │   │   │   ├── register.ts       # Register component (Citizen / Official)
│   │   │   │   ├── register.html     # Register page (2-col form, confirm password)
│   │   │   │   └── register.css      # Master auth CSS (shared by all auth pages)
│   │   │   ├── forgot-password/
│   │   │   │   ├── forgot-password.ts
│   │   │   │   ├── forgot-password.html
│   │   │   │   └── forgot-password.css  # @import register.css + fp-card styles
│   │   │   ├── reset-password/
│   │   │   │   ├── reset-password.ts
│   │   │   │   ├── reset-password.html
│   │   │   │   └── reset-password.css   # @import forgot-password.css
│   │   │   ├── verify-email/
│   │   │   │   ├── verify-email.ts
│   │   │   │   ├── verify-email.html
│   │   │   │   └── verify-email.css
│   │   │   ├── auth.ts               # Auth service — login, register, getMe, logout, JWT storage
│   │   │   ├── auth.guard.ts         # authGuard + guestGuard
│   │   │   └── auth.interceptor.ts   # HTTP interceptor — attaches Bearer token, handles 401
│   │   ├── dashboard/
│   │   │   ├── dashboard.ts          # Dashboard component — user info, nav state, logout
│   │   │   ├── dashboard.html        # Sidebar + topbar + coming soon main area
│   │   │   └── dashboard.css         # 100vh fixed layout, no scroll
│   │   ├── services/
│   │   │   └── location.ts           # LocationService — GPS (Nominatim) + IP fallback chain
│   │   ├── app.ts                    # Root component
│   │   ├── app.html                  # <router-outlet>
│   │   ├── app.css                   # Global app styles
│   │   ├── app.config.ts             # provideRouter + provideHttpClient + authInterceptor
│   │   └── app.routes.ts             # All route definitions
│   ├── environments/
│   │   ├── environment.ts            # Production: { production: true, apiUrl }
│   │   └── environment.development.ts # Dev: { production: false, apiUrl }
│   ├── index.html
│   ├── main.ts
│   └── styles.css                    # Global: background #f0f4f8, overflow hidden
├── .env                              # Local env vars (not committed)
├── angular.json                      # fileReplacements for environment files
├── package.json
├── tsconfig.json
└── tsconfig.app.json
```

---

## Getting Started

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

`src/environments/environment.development.ts`:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://127.0.0.1:8000'
};
```

### 3. Run dev server

```bash
npm start
```

App runs at → **http://localhost:4200**

### 4. Production build

```bash
ng build
```

Output → `dist/`

---

## Auth Flow

```
/register  →  Account created  →  Email verification (Official only)
/login     →  JWT token stored  →  GET /api/auth/me
                                        ↓
                              role === 'citizen'   →  /dashboard
                              role === 'official'  →  /dashboard
```

> Role-based separate dashboards are planned for next milestone.

---

## Route Guards

| Guard | Behavior |
|-------|----------|
| `authGuard` | Redirects to `/login` if not authenticated |
| `guestGuard` | Redirects to `/dashboard` if already logged in |

---

## HTTP Interceptor

`auth.interceptor.ts` automatically:
- Attaches `Authorization: Bearer <token>` to all requests to `apiUrl`
- Skips public endpoints: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/resend-verification`
- On `401` response → clears session → redirects to `/login`

---

## Location Service

`src/app/services/location.ts`

- **Primary**: Browser GPS → Nominatim reverse geocode (`nominatim.openstreetmap.org`)
- **Fallback 1**: `ipapi.co/json/`
- **Fallback 2**: `freeipapi.com/api/json`
- **Fallback 3**: `ipwho.is/`
- **Search**: `searchLocations(query)` — Nominatim autocomplete, returns `"City, State"` strings

---

## Auth Service (`auth.ts`)

| Method | Description |
|--------|-------------|
| `register(data)` | POST `/api/auth/register` |
| `login(data)` | POST `/api/auth/login` → stores JWT |
| `getMe()` | GET `/api/auth/me` → stores user |
| `updateMe(data)` | PUT `/api/auth/me` |
| `logout()` | POST `/api/auth/logout` → clears session |
| `verifyEmail(token)` | GET `/api/auth/verify-email?token=` |
| `resendVerification(email)` | POST `/api/auth/resend-verification` |
| `forgotPassword(email)` | POST `/api/auth/forgot-password` |
| `resetPassword(token, pass)` | POST `/api/auth/reset-password` |
| `isAuthenticated()` | Returns `true` if JWT token exists in localStorage |
| `getUser()` | Returns cached `UserResponse` from BehaviorSubject |
| `clearSession()` | Removes token + user from localStorage |

Token stored as `civix_token`, user as `civix_user` in `localStorage`.

---

## CSS Architecture

```
register.css          ← master auth styles (light theme, left panel, right card)
  └── login.css       ← @import register.css
  └── forgot-password.css  ← @import register.css + fp-card, fp-page styles
        └── reset-password.css  ← @import forgot-password.css
```

All auth pages share:
- `.auth-root` — flex column, 100vh, no scroll
- Left panel — teal gradient, CSS blob wave (`::after` with `border-radius: 50% 0 0 50%`)
- Right panel — white card, 500px fixed width
- Fixed top navbar + 42px slim footer

---

## UI Theme

- Background: `#f0f4f8`
- Citizen accent: `#0d9488` (teal)
- Official accent: `#6366f1` (indigo) — planned
- No body scroll — `overflow: hidden` on body and layout containers
- CIVIX wordmark — bold text only, no icon

---

## Scripts

```bash
npm start          # Dev server → localhost:4200
npm run build      # Production build
npm run watch      # Build with watch mode (development)
npm test           # Unit tests via Vitest
```

---

## Backend

Runs at → **http://127.0.0.1:8000** | Docs → **http://127.0.0.1:8000/docs**
