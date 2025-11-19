-- Users table (for both employers and employees)
CREATE TABLE Users (
    id INT PRIMARY KEY IDENTITY(1,1),
    email NVARCHAR(255) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    user_type NVARCHAR(20) NOT NULL CHECK (user_type IN ('employer', 'employee')),
    name NVARCHAR(255) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);

-- Jobs table
CREATE TABLE Jobs (
    id INT PRIMARY KEY IDENTITY(1,1),
    employer_id INT FOREIGN KEY REFERENCES Users(id),
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    requirements NVARCHAR(MAX),
    location NVARCHAR(255),
    salary NVARCHAR(100),
    created_at DATETIME2 DEFAULT GETDATE(),
    is_active BIT DEFAULT 1
);

-- Applications table
CREATE TABLE Applications (
    id INT PRIMARY KEY IDENTITY(1,1),
    job_id INT FOREIGN KEY REFERENCES Jobs(id),
    employee_id INT FOREIGN KEY REFERENCES Users(id),
    status NVARCHAR(50) DEFAULT 'applied' CHECK (status IN ('applied', 'viewed', 'shortlisted', 'rejected', 'accepted')),
    applied_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

-- Insert Employers
INSERT INTO Users (email, password, user_type, name) VALUES
('tech.company@email.com', '$2a$10$hashedPassword1', 'employer', 'Tech Solutions Inc.'),
('marketing.agency@email.com', '$2a$10$hashedPassword2', 'employer', 'Creative Marketing Agency'),
('finance.corp@email.com', '$2a$10$hashedPassword3', 'employer', 'Global Finance Corp');

-- Insert Employees
INSERT INTO Users (email, password, user_type, name) VALUES
('john.doe@email.com', '$2a$10$hashedPassword4', 'employee', 'John Doe'),
('sarah.smith@email.com', '$2a$10$hashedPassword5', 'employee', 'Sarah Smith'),
('mike.johnson@email.com', '$2a$10$hashedPassword6', 'employee', 'Mike Johnson'),
('emily.wilson@email.com', '$2a$10$hashedPassword7', 'employee', 'Emily Wilson');

select * from Users

-- Insert Jobs (posted by employers)
INSERT INTO Jobs (employer_id, title, description, requirements, location, salary) VALUES
(1, 'Frontend Developer', 'We are looking for a skilled Frontend Developer to join our team. You will be responsible for building responsive web applications using React and modern JavaScript frameworks.', '3+ years of React experience, JavaScript, HTML/CSS, Git', 'Remote', '$70,000 - $90,000'),
(1, 'Backend Developer', 'Join our backend team to develop scalable APIs and services. Work with Node.js, databases, and cloud infrastructure.', 'Node.js, SQL, REST APIs, Docker experience', 'New York, NY', '$80,000 - $110,000'),
(2, 'Digital Marketing Specialist', 'Help our clients grow their online presence through SEO, social media, and content marketing strategies.', 'SEO knowledge, Social media management, Analytics', 'Chicago, IL', '$50,000 - $65,000'),
(2, 'Graphic Designer', 'Create compelling visual designs for digital and print media. Work with our creative team on various client projects.', 'Adobe Creative Suite, UI/UX design, Portfolio required', 'Remote', '$45,000 - $60,000'),
(3, 'Financial Analyst', 'Analyze financial data, prepare reports, and provide insights to support business decisions.', 'Excel, Financial modeling, Bachelor''s in Finance', 'Boston, MA', '$65,000 - $85,000'),
(3, 'Data Entry Clerk', 'Entry-level position for accurate data processing and maintenance of financial records.', 'Attention to detail, Basic Excel, High school diploma', 'Remote', '$35,000 - $42,000');

select * from Jobs

-- Insert Applications (employees applying for jobs)
INSERT INTO Applications (job_id, employee_id, status) VALUES
(1, 4, 'applied'),    -- Emily applied for Frontend Developer
(1, 5, 'viewed'),     -- Sarah applied for Frontend Developer (viewed by employer)
(2, 5, 'shortlisted'), -- Sarah applied for Backend Developer (shortlisted)
(3, 4, 'applied'),    -- Emily applied for Digital Marketing
(3, 6, 'rejected'),   -- Mike applied for Digital Marketing (rejected)
(4, 7, 'accepted'),   -- Emily Wilson applied for Graphic Designer (accepted)
(5, 6, 'applied'),    -- Mike applied for Financial Analyst
(6, 7, 'viewed');     -- Emily Wilson applied for Data Entry (viewed)

select*from Applications

SELECT 'Users' as Table_Name, COUNT(*) as Count FROM Users
UNION ALL
SELECT 'Jobs', COUNT(*) FROM Jobs
UNION ALL
SELECT 'Applications', COUNT(*) FROM Applications;

--Check here to execute some commands that maybe were not initially executed.

-- Users table (for both employers and employees)
CREATE TABLE Users (
    id INT PRIMARY KEY IDENTITY(1,1),
    email NVARCHAR(255) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    user_type NVARCHAR(20) NOT NULL CHECK (user_type IN ('employer', 'employee')),
    name NVARCHAR(255) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE()
);

select* from Users

-- Jobs table
CREATE TABLE Jobs (
    id INT PRIMARY KEY IDENTITY(1,1),
    employer_id INT FOREIGN KEY REFERENCES Users(id),
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX),
    requirements NVARCHAR(MAX),
    location NVARCHAR(255),
    salary NVARCHAR(100),
    created_at DATETIME2 DEFAULT GETDATE(),
    is_active BIT DEFAULT 1
);

ALTER TABLE jobs ADD updated_at DATETIME DEFAULT GETDATE();

select*from Jobs

-- Applications table
CREATE TABLE Applications (
    id INT PRIMARY KEY IDENTITY(1,1),
    job_id INT FOREIGN KEY REFERENCES Jobs(id),
    employee_id INT FOREIGN KEY REFERENCES Users(id),
    status NVARCHAR(50) DEFAULT 'applied' CHECK (status IN ('applied', 'viewed', 'shortlisted', 'rejected', 'accepted')),
    applied_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
-- Add resume fields to Applications table
ALTER TABLE Applications 
ADD 
    resume_filename NVARCHAR(255) NULL,
    resume_url NVARCHAR(500) NULL,
    file_size INT NULL;

select*from Applications

-- Insert Employers
INSERT INTO Users (email, password, user_type, name) VALUES
('tech.company@email.com', '$2a$10$hashedPassword1', 'employer', 'Tech Solutions Inc.'),
('marketing.agency@email.com', '$2a$10$hashedPassword2', 'employer', 'Creative Marketing Agency'),
('finance.corp@email.com', '$2a$10$hashedPassword3', 'employer', 'Global Finance Corp');

-- Insert Employees
INSERT INTO Users (email, password, user_type, name) VALUES
('john.doe@email.com', '$2a$10$hashedPassword4', 'employee', 'John Doe'),
('sarah.smith@email.com', '$2a$10$hashedPassword5', 'employee', 'Sarah Smith'),
('mike.johnson@email.com', '$2a$10$hashedPassword6', 'employee', 'Mike Johnson'),
('emily.wilson@email.com', '$2a$10$hashedPassword7', 'employee', 'Emily Wilson');

select * from Users

-- Insert Jobs (posted by employers)
INSERT INTO Jobs (employer_id, title, description, requirements, location, salary) VALUES
(1, 'Frontend Developer', 'We are looking for a skilled Frontend Developer to join our team. You will be responsible for building responsive web applications using React and modern JavaScript frameworks.', '3+ years of React experience, JavaScript, HTML/CSS, Git', 'Remote', '$70,000 - $90,000'),
(1, 'Backend Developer', 'Join our backend team to develop scalable APIs and services. Work with Node.js, databases, and cloud infrastructure.', 'Node.js, SQL, REST APIs, Docker experience', 'New York, NY', '$80,000 - $110,000'),
(2, 'Digital Marketing Specialist', 'Help our clients grow their online presence through SEO, social media, and content marketing strategies.', 'SEO knowledge, Social media management, Analytics', 'Chicago, IL', '$50,000 - $65,000'),
(2, 'Graphic Designer', 'Create compelling visual designs for digital and print media. Work with our creative team on various client projects.', 'Adobe Creative Suite, UI/UX design, Portfolio required', 'Remote', '$45,000 - $60,000'),
(3, 'Financial Analyst', 'Analyze financial data, prepare reports, and provide insights to support business decisions.', 'Excel, Financial modeling, Bachelor''s in Finance', 'Boston, MA', '$65,000 - $85,000'),
(3, 'Data Entry Clerk', 'Entry-level position for accurate data processing and maintenance of financial records.', 'Attention to detail, Basic Excel, High school diploma', 'Remote', '$35,000 - $42,000');

select * from Jobs

-- Insert Applications (employees applying for jobs)
INSERT INTO Applications (job_id, employee_id, status) VALUES
(1, 4, 'applied'),    -- Emily applied for Frontend Developer
(1, 5, 'viewed'),     -- Sarah applied for Frontend Developer (viewed by employer)
(2, 5, 'shortlisted'), -- Sarah applied for Backend Developer (shortlisted)
(3, 4, 'applied'),    -- Emily applied for Digital Marketing
(3, 6, 'rejected'),   -- Mike applied for Digital Marketing (rejected)
(4, 7, 'accepted'),   -- Emily Wilson applied for Graphic Designer (accepted)
(5, 6, 'applied'),    -- Mike applied for Financial Analyst
(6, 7, 'viewed');     -- Emily Wilson applied for Data Entry (viewed)

select*from Applications

SELECT 'Users' as Table_Name, COUNT(*) as Count FROM Users
UNION ALL
SELECT 'Jobs', COUNT(*) FROM Jobs
UNION ALL
SELECT 'Applications', COUNT(*) FROM Applications;

-- Get all employers and their jobs
SELECT u.id as employer_id, u.name as employer_name, j.id as job_id, j.title
FROM Users u
LEFT JOIN Jobs j ON u.id = j.employer_id
WHERE u.user_type = 'employer';

-- Get all applications with details
SELECT 
    a.id as application_id,
    j.title as job_title,
    employer.name as employer_name,
    employee.name as employee_name,
    a.status,
    a.applied_at
FROM Applications a
JOIN Jobs j ON a.job_id = j.id
JOIN Users employer ON j.employer_id = employer.id
JOIN Users employee ON a.employee_id = employee.id;

SELECT id, resume_filename, resume_url, file_size 
FROM Applications 
WHERE resume_filename IS NOT NULL;

-- Check all applications for Employee 11
SELECT 
  a.id as application_id,
  a.job_id,
  j.title as job_title,
  a.status,
  a.applied_at,
  e.name as employee_name,
  e.id as employee_id
FROM Applications a
JOIN Jobs j ON a.job_id = j.id
JOIN Users e ON a.employee_id = e.id
WHERE a.employee_id = 11
ORDER BY a.applied_at DESC;