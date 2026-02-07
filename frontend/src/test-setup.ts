import { TestBed, TestModuleMetadata } from '@angular/core/testing';
import { provideZonelessChangeDetection, Provider } from '@angular/core';

// Configure TestBed with zoneless change detection for all tests
const originalConfigureTestingModule = TestBed.configureTestingModule.bind(TestBed) as
  (moduleDef: TestModuleMetadata) => typeof TestBed;

TestBed.configureTestingModule = function configureTestingModuleWithZoneless(
  moduleDef: TestModuleMetadata,
): typeof TestBed {
  const providers: Provider[] = (moduleDef.providers ?? []) as Provider[];
  const hasZoneless = providers.some((p: Provider) => {
    if (typeof p === 'object' && 'provide' in p) {
      const provide = (p as { provide: unknown }).provide;
      return typeof provide === 'function' && provide.name.includes('ChangeDetection');
    }
    return false;
  });

  if (!hasZoneless) {
    moduleDef = { ...moduleDef, providers: [provideZonelessChangeDetection(), ...providers] };
  }

  return originalConfigureTestingModule(moduleDef);
} as typeof TestBed.configureTestingModule;
