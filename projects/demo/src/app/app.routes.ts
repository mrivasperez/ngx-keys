import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'feature',
    loadComponent: () => import('./feature/feature.component').then(m => m.FeatureComponent)
  },
  {
    path: 'customize',
    loadComponent: () => import('./customize/customize.component').then(m => m.CustomizeComponent)
  },
  {
    path: 'multi-step',
    loadComponent: () => import('./multi-step/multi-step.component').then(m => m.MultiStepComponent)
  },
  {
    path: 'directive',
    loadComponent: () => import('./directive-demo/directive-demo.component').then(m => m.DirectiveDemoComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
