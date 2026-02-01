import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LineService } from '@core/api/line.service';
import { StopService } from '@core/api/stop.service';
import { ScheduleService } from '@core/api/schedule.service';
import { Line, Stop, TimedEntry, CreateTimedEntryRequest } from '@shared/models';

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-neutral-900">Schedules</h1>
        <button
          (click)="openCreateModal()"
          class="btn btn-primary"
          [disabled]="!selectedStop()">
          + New Schedule Entry
        </button>
      </div>

      <!-- Stop Selector -->
      <div class="card p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1">Line</label>
            <select [(ngModel)]="selectedLineId" (ngModelChange)="onLineChange()" class="input">
              <option value="">Select a line</option>
              @for (line of lines(); track line.id) {
                <option [value]="line.id">{{ line.code }} - {{ line.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1">Stop</label>
            <select [(ngModel)]="selectedStopId" (ngModelChange)="loadSchedules()" class="input" [disabled]="!selectedLineId">
              <option value="">Select a stop</option>
              @for (stop of stops(); track stop.id) {
                <option [value]="stop.id">{{ stop.name }}</option>
              }
            </select>
          </div>
        </div>
      </div>

      @if (selectedStop()) {
        <div class="card">
          <div class="px-6 py-4 border-b border-neutral-200">
            <h2 class="text-lg font-semibold text-neutral-900">
              Schedule for {{ selectedStop()!.name }}
            </h2>
          </div>
          <table class="w-full">
            <thead class="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th class="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Time</th>
                <th class="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of schedules(); track entry.id) {
                <tr class="border-b border-neutral-100 hover:bg-neutral-50">
                  <td class="px-6 py-4 font-mono text-lg font-medium text-neutral-900">
                    {{ entry.time }}
                  </td>
                  <td class="px-6 py-4 text-right">
                    <button (click)="openEditModal(entry)" class="text-primary-600 hover:text-primary-800 mr-4">
                      Edit
                    </button>
                    <button (click)="deleteSchedule(entry)" class="text-red-600 hover:text-red-800">
                      Delete
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="2" class="px-6 py-8 text-center text-neutral-500">
                    No schedule entries for this stop. Add your first departure.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="card p-8 text-center text-neutral-500">
          Select a line and stop to view and manage schedules.
        </div>
      }

      <!-- Create/Edit Modal -->
      @if (showModal()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div class="px-6 py-4 border-b border-neutral-200">
              <h2 class="text-lg font-semibold text-neutral-900">
                {{ editingEntry() ? 'Edit Schedule Entry' : 'New Schedule Entry' }}
              </h2>
            </div>
            <form (ngSubmit)="saveSchedule()" class="p-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Time</label>
                  <input
                    type="time"
                    [(ngModel)]="form.time"
                    name="time"
                    class="input"
                    required
                  />
                </div>
              </div>
              <div class="flex justify-end gap-3 mt-6">
                <button type="button" (click)="closeModal()" class="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  {{ editingEntry() ? 'Save Changes' : 'Create Entry' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class SchedulesComponent implements OnInit {
  lines = signal<Line[]>([]);
  stops = signal<Stop[]>([]);
  schedules = signal<TimedEntry[]>([]);
  selectedStop = signal<Stop | null>(null);
  showModal = signal(false);
  editingEntry = signal<TimedEntry | null>(null);

  selectedLineId = '';
  selectedStopId = '';

  form: CreateTimedEntryRequest = {
    time: ''
  };

  constructor(
    private lineService: LineService,
    private stopService: StopService,
    private scheduleService: ScheduleService
  ) {}

  ngOnInit(): void {
    this.lineService.getAll().subscribe(lines => this.lines.set(lines));
  }

  onLineChange(): void {
    this.selectedStopId = '';
    this.selectedStop.set(null);
    this.schedules.set([]);
    if (this.selectedLineId) {
      this.stopService.getAll(this.selectedLineId).subscribe(stops => this.stops.set(stops));
    } else {
      this.stops.set([]);
    }
  }

  loadSchedules(): void {
    if (this.selectedStopId) {
      const stop = this.stops().find(s => s.id === this.selectedStopId);
      this.selectedStop.set(stop || null);
      this.scheduleService.getForStop(this.selectedStopId).subscribe(schedules => {
        this.schedules.set(schedules.sort((a, b) => a.time.localeCompare(b.time)));
      });
    } else {
      this.selectedStop.set(null);
      this.schedules.set([]);
    }
  }

  openCreateModal(): void {
    this.editingEntry.set(null);
    this.form = { time: '' };
    this.showModal.set(true);
  }

  openEditModal(entry: TimedEntry): void {
    this.editingEntry.set(entry);
    this.form = { time: entry.time };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingEntry.set(null);
  }

  saveSchedule(): void {
    const editing = this.editingEntry();
    const stopId = this.selectedStopId;
    if (editing) {
      this.scheduleService.update(editing.id, this.form).subscribe(() => {
        this.loadSchedules();
        this.closeModal();
      });
    } else {
      this.scheduleService.create(stopId, this.form).subscribe(() => {
        this.loadSchedules();
        this.closeModal();
      });
    }
  }

  deleteSchedule(entry: TimedEntry): void {
    if (confirm(`Delete schedule entry at ${entry.time}?`)) {
      this.scheduleService.delete(entry.id).subscribe(() => this.loadSchedules());
    }
  }
}
