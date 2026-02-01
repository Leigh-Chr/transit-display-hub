import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, ApplicationConfig } from '@angular/core';
import { beforeEach } from 'vitest';

// Configure TestBed with zoneless change detection for all tests
const originalConfigureTestingModule = TestBed.configureTestingModule.bind(TestBed);

TestBed.configureTestingModule = function(moduleDef: any) {
  // Ensure zoneless change detection is always provided
  const providers = moduleDef.providers || [];
  const hasZoneless = providers.some((p: any) =>
    p?.provide?.toString?.().includes('ChangeDetection') ||
    p?.ɵprov?.token?.toString?.().includes('ChangeDetection')
  );

  if (!hasZoneless) {
    moduleDef.providers = [provideZonelessChangeDetection(), ...providers];
  }

  return originalConfigureTestingModule(moduleDef);
};
