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
        path: 'lines',
        canActivate: [roleGuard],
        data: { requiredRole: 'ADMIN' },
        loadComponent: () => import('./features/admin/lines/lines.component').then(m => m.LinesComponent)
      },
      {
        path: 'stops',
        canActivate: [roleGuard],
        data: { requiredRole: 'ADMIN' },
        loadComponent: () => import('./features/admin/stops/stops.component').then(m => m.StopsComponent)
      },
      {
        path: 'itineraries',
        canActivate: [roleGuard],
        data: { requiredRole: 'ADMIN' },
        loadComponent: () => import('./features/admin/itineraries/itineraries.component').then(m => m.ItinerariesComponent)
      },
      {
        path: 'schedules',
        canActivate: [roleGuard],
        data: { requiredRole: 'ADMIN' },
        loadComponent: () => import('./features/admin/schedules/schedules.component').then(m => m.SchedulesComponent)
      },
      {
        path: 'messages',
        loadComponent: () => import('./features/admin/messages/messages.component').then(m => m.MessagesComponent)
      },
      {
        path: 'devices',
        canActivate: [roleGuard],
        data: { requiredRole: 'ADMIN' },
        loadComponent: () => import('./features/admin/devices/devices.component').then(m => m.DevicesComponent)
      },
      {
        path: 'realtime',
        canActivate: [roleGuard],
        data: { requiredRole: 'ADMIN' },
        loadComponent: () => import('./features/admin/realtime/realtime.component').then(m => m.RealtimeComponent)
      },
      {
        path: 'gtfs-data',
        canActivate: [roleGuard],
        data: { requiredRole: 'ADMIN' },
        loadComponent: () => import('./features/admin/gtfs-data/gtfs-data.component').then(m => m.GtfsDataComponent)
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: { requiredRole: 'ADMIN' },
        loadComponent: () => import('./features/admin/users/users.component').then(m => m.UsersComponent)
      }
    ]
  },
  {
    path: 'map',
    loadComponent: () => import('./features/network-map/network-map.component').then(m => m.NetworkMapComponent)
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
