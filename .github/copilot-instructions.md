You are an expert in TypeScript, Angular, and Angular library development. This is **NgxKeys**, an Angular library project using Angular 20+ with strict TypeScript configuration and modern Angular patterns.

## Project Architecture

This is an **Angular library workspace** using the modern Angular CLI library structure:
- **Root workspace**: Contains build configuration and workspace-level dependencies
- **Library project**: Located in `projects/ngx-keys/` with its own `package.json` and build config
- **Build output**: Libraries are built to `dist/ngx-keys/` using ng-packagr
- **Public API**: All exports must go through `projects/ngx-keys/src/public-api.ts`

## Key Development Workflows

### Building the Library
```bash
ng build ngx-keys                 # Build for production (default)
ng build ngx-keys --configuration development  # Build for development
```

### Testing
```bash
ng test                         # Run Karma tests for the library
ng test ngx-keys                # Explicit library target
```

### Library Structure
- **Entry point**: `projects/ngx-keys/src/public-api.ts` - ALL exports must be declared here
- **Main library code**: `projects/ngx-keys/src/lib/` - Contains components, services, directives
- **Component prefix**: `ngx-keys` (configured in `angular.json`)
- **TypeScript paths**: Use `ngx-keys` import alias that maps to `./dist/ngx-keys`

## TypeScript Configuration

This project uses **strict TypeScript** with enhanced compiler options:
- `strict: true` with `noImplicitReturns`, `noPropertyAccessFromIndexSignature`
- `isolatedModules: true` for better tree-shaking
- **Project references** using `tsconfig.json` references for the library
- **Path mapping** for library imports in consuming applications

## Angular Library Best Practices

### Components
- Use standalone components (default in Angular 20+)
- Follow `ngx-keys` prefix convention for component selectors
- Use inline templates for simple components (as shown in `ngx-keys.component.ts`)
- Import statements should use the library's public API when cross-referencing

### Library Publishing Pattern
- Build artifacts go to `dist/ngx-keys/`
- `package.json` defines peer dependencies (Angular core/common)
- `sideEffects: false` enables tree-shaking
- Use ng-packagr for proper Angular library bundling

### Development vs Production
- **Development builds**: Include declaration maps for debugging
- **Production builds**: Exclude declaration maps, use partial compilation mode
- **Import paths**: Use `ngx-keys` alias, not relative paths to `dist/`

## Code Formatting

This project uses Prettier with specific Angular configurations:
- **Print width**: 100 characters
- **Single quotes** for TypeScript/JavaScript
- **Angular parser** for HTML templates
- Follow `.editorconfig` settings (2-space indentation)

## Testing Patterns

- Use **standalone component testing** with `TestBed.configureTestingModule({ imports: [Component] })`
- Test files follow `.spec.ts` convention
- Karma configuration optimized for library testing
