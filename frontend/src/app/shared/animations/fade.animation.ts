import { trigger, transition, style, animate } from '@angular/animations';

// M3 Easing Curve
const M3_EMPHASIZED_DECELERATE = 'cubic-bezier(0.05, 0.7, 0.1, 1)';

export const fadeIn = trigger('fadeIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(-10px)' }),
    animate(`200ms ${M3_EMPHASIZED_DECELERATE}`, style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
]);
