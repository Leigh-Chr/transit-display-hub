import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LineService } from '@core/api/line.service';
import { Line, CreateLineRequest } from '@shared/models';

@Component({
  selector: 'app-lines',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-neutral-900">Lines</h1>
        <button (click)="openCreateModal()" class="btn btn-primary">
          + New Line
        </button>
      </div>

      <!-- Lines Table -->
      <div class="card">
        <table class="w-full">
          <thead class="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th class="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Code</th>
              <th class="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Name</th>
              <th class="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Color</th>
              <th class="text-left px-6 py-3 text-sm font-semibold text-neutral-700">Stops</th>
              <th class="text-right px-6 py-3 text-sm font-semibold text-neutral-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (line of lines(); track line.id) {
              <tr class="border-b border-neutral-100 hover:bg-neutral-50">
                <td class="px-6 py-4">
                  <span
                    class="inline-block px-3 py-1 rounded-full text-white text-sm font-medium"
                    [style.backgroundColor]="line.color">
                    {{ line.code }}
                  </span>
                </td>
                <td class="px-6 py-4 font-medium text-neutral-900">{{ line.name }}</td>
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded" [style.backgroundColor]="line.color"></div>
                    <span class="text-neutral-600 text-sm">{{ line.color }}</span>
                  </div>
                </td>
                <td class="px-6 py-4 text-neutral-600">{{ line.stopCount }} stops</td>
                <td class="px-6 py-4 text-right">
                  <button (click)="openEditModal(line)" class="text-primary-600 hover:text-primary-800 mr-4">
                    Edit
                  </button>
                  <button (click)="deleteLine(line)" class="text-red-600 hover:text-red-800">
                    Delete
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" class="px-6 py-8 text-center text-neutral-500">
                  No lines configured. Create your first line to get started.
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
                {{ editingLine() ? 'Edit Line' : 'New Line' }}
              </h2>
            </div>
            <form (ngSubmit)="saveLine()" class="p-6">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Code</label>
                  <input
                    type="text"
                    [(ngModel)]="form.code"
                    name="code"
                    class="input"
                    placeholder="e.g., L1, M2, T3"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Name</label>
                  <input
                    type="text"
                    [(ngModel)]="form.name"
                    name="name"
                    class="input"
                    placeholder="e.g., Line 1 - Downtown Express"
                    required
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-neutral-700 mb-1">Color</label>
                  <div class="flex gap-2">
                    <input
                      type="color"
                      [(ngModel)]="form.color"
                      name="color"
                      class="w-12 h-10 rounded border border-neutral-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      [(ngModel)]="form.color"
                      name="colorText"
                      class="input flex-1"
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
              </div>
              <div class="flex justify-end gap-3 mt-6">
                <button type="button" (click)="closeModal()" class="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">
                  {{ editingLine() ? 'Save Changes' : 'Create Line' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `
})
export class LinesComponent implements OnInit {
  lines = signal<Line[]>([]);
  showModal = signal(false);
  editingLine = signal<Line | null>(null);

  form: CreateLineRequest = {
    code: '',
    name: '',
    color: '#3B82F6'
  };

  constructor(private lineService: LineService) {}

  ngOnInit(): void {
    this.loadLines();
  }

  loadLines(): void {
    this.lineService.getAll().subscribe(lines => this.lines.set(lines));
  }

  openCreateModal(): void {
    this.editingLine.set(null);
    this.form = { code: '', name: '', color: '#3B82F6' };
    this.showModal.set(true);
  }

  openEditModal(line: Line): void {
    this.editingLine.set(line);
    this.form = { code: line.code, name: line.name, color: line.color };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingLine.set(null);
  }

  saveLine(): void {
    const editing = this.editingLine();
    if (editing) {
      this.lineService.update(editing.id, this.form).subscribe(() => {
        this.loadLines();
        this.closeModal();
      });
    } else {
      this.lineService.create(this.form).subscribe(() => {
        this.loadLines();
        this.closeModal();
      });
    }
  }

  deleteLine(line: Line): void {
    if (confirm(`Delete line "${line.name}"? This will also delete all associated stops and schedules.`)) {
      this.lineService.delete(line.id).subscribe(() => this.loadLines());
    }
  }
}
