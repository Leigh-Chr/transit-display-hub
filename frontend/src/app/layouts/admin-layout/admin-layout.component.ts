import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen flex">
      <!-- Sidebar -->
      <aside class="w-60 bg-neutral-900 text-white flex flex-col">
        <div class="p-4 border-b border-neutral-700">
          <h1 class="text-lg font-bold">Transit Display Hub</h1>
        </div>

        <nav class="flex-1 py-4">
          <a
            routerLink="/admin/dashboard"
            routerLinkActive="bg-primary-600"
            class="flex items-center px-4 py-3 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <span class="mr-3">📊</span> Dashboard
          </a>

          <div class="px-4 py-2 text-xs text-neutral-500 uppercase tracking-wider mt-4">Network</div>

          <a
            routerLink="/admin/lines"
            routerLinkActive="bg-primary-600"
            class="flex items-center px-4 py-3 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <span class="mr-3">🚇</span> Lines
          </a>

          <a
            routerLink="/admin/stops"
            routerLinkActive="bg-primary-600"
            class="flex items-center px-4 py-3 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <span class="mr-3">🚏</span> Stops
          </a>

          <a
            routerLink="/admin/schedules"
            routerLinkActive="bg-primary-600"
            class="flex items-center px-4 py-3 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <span class="mr-3">🕐</span> Schedules
          </a>

          <div class="px-4 py-2 text-xs text-neutral-500 uppercase tracking-wider mt-4">Communication</div>

          <a
            routerLink="/admin/messages"
            routerLinkActive="bg-primary-600"
            class="flex items-center px-4 py-3 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <span class="mr-3">📢</span> Messages
          </a>

          <a
            routerLink="/admin/devices"
            routerLinkActive="bg-primary-600"
            class="flex items-center px-4 py-3 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            <span class="mr-3">📺</span> Devices
          </a>
        </nav>
      </aside>

      <!-- Main content -->
      <div class="flex-1 flex flex-col">
        <!-- Header -->
        <header class="bg-white border-b border-neutral-200 px-6 py-4 flex justify-between items-center">
          <div></div>
          <div class="flex items-center gap-4">
            <span class="text-neutral-600">{{ authService.currentUser()?.username }}</span>
            <button (click)="logout()" class="btn btn-ghost text-sm">Logout</button>
          </div>
        </header>

        <!-- Page content -->
        <main class="flex-1 p-6 bg-neutral-50 overflow-auto">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class AdminLayoutComponent {
  constructor(public authService: AuthService) {}

  logout(): void {
    this.authService.logout();
  }
}
