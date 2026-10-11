# Library Books API

Base path: `/api/books`

## Endpoints

- **GET `/api/books`** - List all books. Success: `200 OK`.
- **GET `/api/books/{bookId}`** - Get one book by its ID. Success: `200 OK`.
- **POST `/api/books`** - Create a book. Example request body:
  ```json
  {
    "title": "The Left Hand of Darkness",
    "author": "Ursula K. Le Guin",
    "publishedYear": 1969
  }
  ```
  Success: `201 Created`.
- **PUT `/api/books/{bookId}`** - Replace a book's details. Example request body:
  ```json
  {
    "title": "The Left Hand of Darkness",
    "author": "Ursula K. Le Guin",
    "publishedYear": 1969
  }
  ```
  Success: `200 OK`.
- **DELETE `/api/books/{bookId}`** - Delete a book by its ID. Success: `204 No Content`.
- **GET `/api/books?author=Ursula%20K.%20Le%20Guin`** - List books by the author supplied in the `author` query parameter. Success: `200 OK`.

## Errors

- **`400 Bad Request`** - The request is invalid, such as a create request missing the required `title` field.
- **`404 Not Found`** - The requested book ID does not exist, such as `GET /api/books/9999` when there is no book with ID `9999`.