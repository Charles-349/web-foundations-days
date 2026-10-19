PRAGMA foreign_keys = ON;

CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE enrolments (
    student_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    grade INTEGER NOT NULL CHECK (grade BETWEEN 0 AND 100),
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES students (student_id),
    FOREIGN KEY (course_id) REFERENCES courses (course_id)
);

INSERT INTO students (student_id, name, email) VALUES
    (1, 'Ada Lovelace', 'ada@example.com'),
    (2, 'Grace Hopper', 'grace@example.com'),
    (3, 'Katherine Johnson', 'katherine@example.com'),
    (4, 'Alan Turing', 'alan@example.com');

INSERT INTO courses (course_id, name) VALUES
    (1, 'Mathematics'),
    (2, 'Computer Science'),
    (3, 'Physics');

INSERT INTO enrolments (student_id, course_id, grade) VALUES
    (1, 1, 95),
    (1, 2, 98),
    (2, 2, 92),
    (2, 3, 88),
    (3, 1, 91);

-- All courses for one student, selected by name.
SELECT c.name AS course_name
FROM students AS s
JOIN enrolments AS e ON e.student_id = s.student_id
JOIN courses AS c ON c.course_id = e.course_id
WHERE s.name = 'Ada Lovelace'
ORDER BY c.name;

-- All students enrolled on one course.
SELECT s.name AS student_name
FROM courses AS c
JOIN enrolments AS e ON e.course_id = c.course_id
JOIN students AS s ON s.student_id = e.student_id
WHERE c.name = 'Computer Science'
ORDER BY s.name;

-- Number of students per course, including courses with no enrolments.
SELECT c.name AS course_name, COUNT(e.student_id) AS student_count
FROM courses AS c
LEFT JOIN enrolments AS e ON e.course_id = c.course_id
GROUP BY c.course_id, c.name
ORDER BY c.name;

-- Students who have no enrolments.
SELECT s.name AS student_name
FROM students AS s
LEFT JOIN enrolments AS e ON e.student_id = s.student_id
WHERE e.student_id IS NULL
ORDER BY s.name;

-- Update one student's grade on one course.
UPDATE enrolments
SET grade = 96
WHERE student_id = 1 AND course_id = 1;
