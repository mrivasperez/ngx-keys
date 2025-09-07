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

- **Reactive Signals**: Track active/inactive shortcuts with Angular signals
- **Cross-Platform**: Automatic Mac/PC key display formatting  
- **Dynamic Management**: Add/remove shortcuts at runtime
- **Group Management**: Organize shortcuts into logical groups
- **Browser-Safe**: Documentation on avoiding browser conflicts

## 📖 Documentation

For complete API documentation, examples, and best practices, see:
**[NgxKeys Library Documentation](./projects/ngx-keys/README.md)**

## 🧪 Development Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start demo application |
| `npm test` | Run unit tests |
| `ng build ngx-keys` | Build library |
| `ng build ngx-keys --watch` | Build library in watch mode |

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
