import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { Line, Stop, CreateStopRequest } from '@shared/models';

@Component({
  selector: 'app-stops',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-neutral-900">Stops</h1>
        <button (click)="openCreateModal()" class="btn btn-primary" [disabled]="lines().length === 0">
          + New Stop
        </button>
      </div>

      <!-- Line Filter -->
      <div class="mb-4">
        <select [(ngModel)]="selectedLineId" (ngModelChange)="loadStops()" class="input w-64">
          <option value="">All Lines</option>
          @for (line of lines(); track line.id) {
            <option [value]="line.id">{{ line.code }} - {{ line.name }}</option>
          }
        </select>
      </div>

      <!-- Stops Table -->
      <div class="card">
        <table class="w-full">
          <thead class="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th class="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Line</th>
              <th class="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Name</th>
              <th class="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Schedules</th>
              <th class="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (stop of stops(); track stop.id) {
              <tr class="border-b border-neutral-100 hover:bg-neutral-50">
                <td class="px-6 py-4">
                  <span
                    class="inline-block px-3 py-1 rounded-full text-white text-sm font-medium"
                    [style.backgroundColor]="stop.line.color">
                    {{ stop.line.code }}
                  </span>
                </td>
                <td class="px-6 py-4 font-medium text-neutral-900">{{ stop.name }}</td>
                <td class="px-6 py-4 text-neutral-600">{{ stop.scheduleCount }} entries</td>
                <td class="px-6 py-4 text-right">
                  <button (click)="openEditModal(stop)" class="text-primary-600 hover:text-primary-800 mr-4">
                    Edit
                  </button>
                  <button (click)="deleteStop(stop)" class="text-red-600 hover:text-red-800">
                    Delete
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="px-6 py-8 text-center text-neutral-500">
                  @if (lines().length === 0) {
                    Create a line first before adding stops.
                  } @else {
                    No stops found. Create your first stop to get started.
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Create/Edit Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div class="px-6 py-4 border-b border-neutral-200">
              <h2 class="text-lg font-semibold text-neutral-900">
                {{ editingStop() ? 'Edit Stop' : 'New Stop' }}
              </h2>
            </div>
            <form (ngSubmit)="saveStop()" class="p-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Line</label>
                  <select
                    [(ngModel)]="form.lineId"
                    name="lineId"
                    class="input"
                    required
                    [disabled]="!!editingStop()">
                    <option value="">Select a line</option>
                    @for (line of lines(); track line.id) {
                      <option [value]="line.id">{{ line.code }} - {{ line.name }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Name</label>
                  <input
                    type="text"
                    [(ngModel)]="form.name"
                    name="name"
                    class="input"
                    placeholder="e.g., Central Station"
                    required
                  />
                </div>
              </div>
              <div class="flex justify-end gap-3 mt-6">
                <button type="button" (click)="closeModal()" class="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  {{ editingStop() ? 'Save Changes' : 'Create Stop' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class StopsComponent implements OnInit {
  lines = signal<Line[]>([]);
  stops = signal<Stop[]>([]);
  showModal = signal(false);
  editingStop = signal<Stop | null>(null);
  selectedLineId = '';

  form: CreateStopRequest = {
    lineId: '',
    name: ''
  };

  constructor(
    private lineService: LineService,
    private stopService: StopService
  ) {}

  ngOnInit(): void {
    this.loadLines();
    this.loadStops();
  }

  loadLines(): void {
    this.lineService.getAll().subscribe(lines => this.lines.set(lines));
  }

  loadStops(): void {
    const lineId = this.selectedLineId || undefined;
    this.stopService.getAll(lineId).subscribe(stops => this.stops.set(stops));
  }

  openCreateModal(): void {
    this.editingStop.set(null);
    this.form = { lineId: this.selectedLineId || '', name: '' };
    this.showModal.set(true);
  }

  openEditModal(stop: Stop): void {
    this.editingStop.set(stop);
    this.form = { lineId: stop.line.id || '', name: stop.name };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingStop.set(null);
  }

  saveStop(): void {
    const editing = this.editingStop();
    if (editing) {
      this.stopService.update(editing.id, this.form).subscribe(() => {
        this.loadStops();
        this.closeModal();
      });
    } else {
      this.stopService.create(this.form).subscribe(() => {
        this.loadStops();
        this.closeModal();
      });
    }
  }

  deleteStop(stop: Stop): void {
    if (confirm(`Delete stop "${stop.name}"? This will also delete all associated schedules.`)) {
      this.stopService.delete(stop.id).subscribe(() => this.loadStops());
    }
  }
}
