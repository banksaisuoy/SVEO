# VisionHub Tests

This directory contains unit tests for the VisionHub application.

## Test Structure

- `user.model.test.js` - Tests for the User model
- `category.model.test.js` - Tests for the Category model
- `video.model.test.js` - Tests for the Video model

## Running Tests

To run all tests:

```bash
npm test
```

To run tests in watch mode:

```bash
npm run test:watch
```

## Test Coverage

The tests currently cover:
- User password validation
- Category CRUD operations
- Video CRUD operations

## Technologies Used

- Jest for test framework
- Supertest for API testing (installed but not currently used in unit tests)