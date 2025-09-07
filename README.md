# NgxKeys

A reactive Angular library for managing keyboard shortcuts with signals-based UI integration.

## 📁 Project Structure

This is an Angular workspace containing:

- **`projects/ngx-keys/`** - The NgxKeys library source code
- **`projects/demo/`** - Demo application showcasing library features
- **Library Documentation** - See [`projects/ngx-keys/README.md`](./projects/ngx-keys/README.md) for complete API documentation

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Run Demo Application
```bash
npm start
```
Navigate to `http://localhost:4200/` to see the demo.

### Build Library
```bash
ng build ngx-keys
```

### Run Tests
```bash
npm test
```

## 🎯 Library Features

- **Reactive Signals**: Track active/inactive shortcuts with Angular signals for seamless UI integration
- **Safe Registration**: Both strict (exception-throwing) and safe (result-returning) registration methods
- **Cross-Platform**: Automatic Mac/PC key display formatting (`Ctrl+S` vs `⌘+S`)
- **Dynamic Management**: Add, remove, activate/deactivate shortcuts and groups at runtime
- **Group Management**: Organize shortcuts into logical groups with bulk operations
- **Conflict Detection**: Comprehensive validation to prevent duplicate IDs and key combinations
- **Browser-Safe**: Documentation on avoiding browser conflicts
- **Fully Tested**: 76 test cases with comprehensive coverage

## 📖 Documentation

For complete API documentation, examples, and best practices, see:
**[NgxKeys Library Documentation](./projects/ngx-keys/README.md)**

## 🧪 Development Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start demo application at http://localhost:4200 |
| `npm test` | Run unit tests (76 test cases) |
| `ng test ngx-keys` | Run library tests specifically |
| `ng build ngx-keys` | Build library for production |
| `ng build ngx-keys --watch` | Build library in watch mode |
| `ng build demo` | Build demo application |
| `ng test ngx-keys --watch=false` | Run tests once without watch mode |

## 🏗️ Building

### Library
```bash
ng build ngx-keys
```

### Demo Application  
```bash
ng build demo
```

## 📦 Publishing

1. Build the library:
   ```bash
   ng build ngx-keys
   ```

2. Navigate to dist directory:
   ```bash
   cd dist/ngx-keys
   ```

3. Publish to npm:
   ```bash
   npm publish
   ```
