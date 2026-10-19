# School Database Design

## Tables and relationships

- **Students** stores each student's name and unique email address. A student can have enrolments in multiple courses.
- **Courses** stores the name of each course. A course can have multiple enrolled students.
- **Enrolments** records the fact that a student takes a course and stores that student's grade for it. Its two foreign keys connect students and courses, and their composite primary key prevents the same student from enrolling in the same course twice.

Students and enrolments have a one-to-many relationship: one student can have many enrolment records, while each enrolment belongs to one student. Courses and enrolments also have a one-to-many relationship. Taken together, students and courses have a many-to-many relationship, because each student can take multiple courses and each course can have multiple students. A join table is needed to represent that relationship in a relational database and to store relationship-specific data such as the grade.

## Index

I would add an index on `enrolments(course_id, student_id)`. It supports looking up students enrolled in a course and grouping enrolments by course, including the course-count query. The existing composite primary key begins with `student_id`, so it is not as useful for searches that start with `course_id`.

## SQL or NoSQL?

I would choose SQL for this system. Students, courses, and enrolments have clear relationships and integrity rules: each enrolment must refer to an existing student and course, emails must be unique, and duplicate student-course pairs must be rejected. A relational database enforces these constraints and makes the required joins and grouped counts straightforward. The data is also structured and consistent, so a document database's flexible schema would not offer a meaningful advantage here.
