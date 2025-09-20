# Contributing

<!-- Based on the CONTRIBUTING.md from https://github.com/ng-primitives/ng-primitives -->

We welcome contributions from the community! Whether you're a seasoned developer or just getting started, there are many ways to get involved. Here are a few ideas to get you started:

- **Report a bug**: If you find a bug in the library, please open an issue on GitHub. Be sure to include a detailed description of the bug, steps to reproduce, and any relevant code snippets.
- **Request a feature**: If you have an idea for a new feature or enhancement, please open an issue on GitHub. Be sure to include a detailed description of the feature, use cases, and any relevant code snippets.
- **Submit a pull request**: If you'd like to contribute code to the library, please open a pull request on GitHub. Be sure to include a detailed description of the changes, any relevant issue numbers, and any relevant code snippets.
- **Improve the documentation**: Documentation is a critical part of any library. If you'd like to help improve the library's documentation, please open a pull request on GitHub.
- **Spread the word**: If you enjoy using the library, please consider sharing it with others. The more people who use the library, the more feedback we'll receive, and the better the library will become.

## Requesting a new feature

If you wish to develop a feature, please raise an issue or discussion first to discuss the feature and how it fits into the library.
We don't want you to spend time developing a feature that we may not be able to accept.

## Submitting a pull request

Before submitting a pull request, please make sure the following steps are completed:

1. Fork the repository and create a new branch from `develop`.
1. Make your changes and ensure the tests pass.
1. Update the documentation if necessary.
1. Format the code before submitting a pull request.
1. Submit a pull request with a detailed description of the changes.

## Commit message guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for commit messages. This allows us to automatically generate a changelog and version the library.

Here are a few examples of valid commit messages:

- `feat: support repeating shortcuts on holding key`
- `fix: resolve issue with bulk updating shortcuts`
- `docs: adding documentation for grouping shortcuts`
- `chore: format code`
- `chore: update dependencies`

## Setting up the development environment

To set up the development environment, follow these steps:

1. Clone the repository: `git clone https://github.com/mrivasperez/ngx-keys.git`
2. Install the dependencies: `npm install`
3. Start the documentation server: `npm start`

## Running the tests

To run the tests, use the following command:

```bash
npm run test
```

## Building the library

To build the library, use the following command:

```bash
ng build ngx-keys
```
