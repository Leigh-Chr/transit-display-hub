import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component')
        .then(m => m.ChangePasswordComponent)
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'messages',
        loadComponent: () => import('./features/admin/messages/messages.component').then(m => m.MessagesComponent)
      },
      {
        // Anonymous intermediate (`path: ''` with no component) so the
        // ADMIN-only `canActivateChild` applies to every nested route
        // without changing the URL. Collapses what used to be 14 copies
        // of `canActivate: [roleGuard], data: { requiredRole: 'ADMIN' }`
        // into one rule.
        path: '',
        canActivateChild: [roleGuard],
        data: { requiredRole: 'ADMIN' },
        children: [
          {
            path: 'lines',
            loadComponent: () => import('./features/admin/lines/lines.component').then(m => m.LinesComponent)
          },
          {
            path: 'stops',
            loadComponent: () => import('./features/admin/stops/stops.component').then(m => m.StopsComponent)
          },
          {
            path: 'itineraries',
            loadComponent: () => import('./features/admin/itineraries/itineraries.component').then(m => m.ItinerariesComponent)
          },
          {
            path: 'schedules',
            loadComponent: () => import('./features/admin/schedules/schedules.component').then(m => m.SchedulesComponent)
          },
          {
            path: 'devices',
            loadComponent: () => import('./features/admin/devices/devices.component').then(m => m.DevicesComponent)
          },
          {
            path: 'realtime',
            loadComponent: () => import('./features/admin/realtime/realtime.component').then(m => m.RealtimeComponent)
          },
          {
            path: 'gtfs-data',
            loadComponent: () => import('./features/admin/gtfs-data/gtfs-data.component').then(m => m.GtfsDataComponent)
          },
          {
            path: 'import-audit',
            loadComponent: () => import('./features/admin/import-audit/import-audit.component').then(m => m.ImportAuditComponent)
          },
          {
            path: 'pathways',
            loadComponent: () => import('./features/admin/pathways/pathways.component').then(m => m.PathwaysComponent)
          },
          {
            path: 'shapes',
            loadComponent: () => import('./features/admin/shapes/shapes.component').then(m => m.ShapesComponent)
          },
          {
            path: 'users',
            loadComponent: () => import('./features/admin/users/users.component').then(m => m.UsersComponent)
          }
        ]
      }
    ]
  },
  {
    path: 'map',
    loadComponent: () => import('./features/network-map/network-map.component').then(m => m.NetworkMapComponent)
  },
  {
    // Tabular alternative to the SVG map for keyboard / screen-reader
    // users. Ships every line and every stop the schematic exposes,
    // navigable with Tab / arrow keys.
    path: 'map/list',
    loadComponent: () => import('./features/network-map/network-list/network-list.component').then(m => m.NetworkListComponent)
  },
  {
    path: 'display',
    loadComponent: () => import('./features/display/kiosk/kiosk.component').then(m => m.KioskComponent)
  },
  {
    path: 'display/:stopId',
    loadComponent: () => import('./features/display/kiosk/kiosk.component').then(m => m.KioskComponent)
  },
  {
    path: 'hub',
    loadComponent: () => import('./features/display/hub/hub.component').then(m => m.HubComponent)
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
