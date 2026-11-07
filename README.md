# Waheed Abbas | AI Engineer Portfolio

<p align="center">
  <strong>A Modern, Full-Stack AI Engineer Portfolio</strong>
</p>

<p align="center">
  A visually immersive personal portfolio featuring interactive 3D animations, an AI-powered chatbot, voice interaction, a dynamic content management system, and automated contact email notifications.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.x-blue?logo=python" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/SQLAlchemy-ORM-red" alt="SQLAlchemy">
  <img src="https://img.shields.io/badge/Alembic-Migrations-orange" alt="Alembic">
  <img src="https://img.shields.io/badge/Gemini-AI--Powered-8E75B2" alt="Gemini">
  <img src="https://img.shields.io/badge/Three.js-3D--Graphics-black?logo=threedotjs" alt="Three.js">
  <img src="https://img.shields.io/badge/Tests-Pytest%20%7C%20Node.js-success" alt="Tests">
</p>

---

## Overview

**Waheed Abbas AI Portfolio** is a modern, full-stack personal portfolio application designed to showcase professional skills, projects, education, certifications, and AI engineering capabilities.

Unlike a traditional static portfolio, this application combines immersive 3D visuals, interactive UI components, AI-powered conversations, and a private administrative dashboard into one integrated platform.

The application includes a Gemini-powered chatbot that answers questions using published portfolio content, voice interaction capabilities, and a contact form with email notifications.

It also provides an administrative content management system (CMS), allowing the portfolio owner to manage website content without manually editing source code.

## Key Features

### 1. Interactive 3D User Interface

- Animated 3D background powered by Three.js.
- Interactive 3D tilt effects on cards.
- Smooth page transitions and animations.
- Modern hover effects and interactive elements.
- Responsive layouts for desktop, tablet, and mobile.
- Dark mode and light mode toggle.
- Consistent visual experience across public pages.

### 2. AI-Powered Gemini Chatbot

- Integrated Google Gemini AI.
- Retrieval grounded in published portfolio content.
- Answers questions about skills, projects, education, and experience.
- Voice interaction capabilities.
- Text-based conversations.
- Suggested questions for visitors.
- Chatbot can be enabled or disabled through the admin dashboard.
- Draft and unpublished content is excluded from chatbot knowledge.

### 3. Private Admin Dashboard

A dedicated administrative interface for managing the portfolio.

**Content Management**
- Update website text and personal information.
- Manage skills and technologies.
- Add, edit, delete, and reorder projects.
- Publish and unpublish projects.
- Manage education and certifications.
- Update website settings and design preferences.

**Media Library**
- Upload profile images.
- Manage project thumbnails.
- Upload and manage CV/resume PDF files.
- Select uploaded media in relevant content forms.

**Message Management**
- View contact form submissions.
- Review incoming messages.
- Retry failed email notifications.

**Chatbot Management**
- Enable or disable the AI chatbot.
- Manage suggested questions.
- Control published-content-based chatbot behavior.

### 4. Contact Form & Email Notifications

- Interactive contact form.
- Backend validation.
- Message storage in the database.
- Email notifications using configured email services.
- Failed email handling and retry support.
- Administrative message management.

### 5. Dark Mode & Light Mode

- Theme toggle in the website header.
- Separate dark and light visual themes.
- Theme defaults configurable through website settings.
- Consistent styling across the public interface.

### 6. Security & Administration

- Private admin dashboard.
- Authentication and protected administrative routes.
- Environment-based configuration.
- Secret and API key management through environment variables.
- Database-backed content management.
- Published-content controls for chatbot knowledge.

---

## Technology Stack

| Category | Technologies |
|---|---|
| Backend | Python, FastAPI |
| ORM | SQLAlchemy 2 |
| Database | PostgreSQL, SQLite |
| Database Migrations | Alembic |
| AI Integration | Google Gemini |
| Frontend | HTML, CSS, JavaScript |
| 3D Graphics | Three.js |
| Email | Configurable email provider |
| Backend Testing | Pytest |
| Frontend Testing | Node.js, node:test |
| Containerization | Docker |
| Code Quality | Ruff |
| Deployment | Vercel static frontend / supported backend hosting |

---

## Project Structure

```text
waheed-portfolio/
│
├── app/
│   ├── main.py
│   ├── core/
│   ├── api/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   └── ...
│
├── admin/
│   └── ...
│
├── public/
│   └── ...
│
├── vercel-site/
│   └── ...
│
├── alembic/
│   └── versions/
│
├── data/
│   └── ...
│
├── scripts/
│   └── ...
│
├── tests/
│   ├── test_admin_content.py
│   ├── test_auth.py
│   └── test_contact_chat.py
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── DEPLOYMENT.md
│   ├── EMAIL_SETUP.md
│   ├── ADMIN_GUIDE.md
│   ├── MIGRATION_FROM_EXISTING_SITE.md
│   └── IMPLEMENTATION_REPORT.md
│
├── .env.example
├── .gitignore
├── alembic.ini
├── Dockerfile
├── pyproject.toml
├── package.json
└── README.md
```

*Note: This structure highlights the main project directories. Individual files and additional modules may vary.*

---

## Getting Started

Follow these instructions to run the project locally on Windows.

### Prerequisites

Make sure the following tools are installed:

- Python 3.x
- Git
- PostgreSQL (for local database setup)
- Node.js and npm
- A Google Gemini API key
- A configured email service for contact notifications

### 1. Clone the Repository

```powershell
git clone https://github.com/YOUR_USERNAME/waheed-portfolio.git
```

Navigate into the project:

```powershell
cd waheed-portfolio
```

### 2. Create a Virtual Environment

```powershell
python -m venv .venv
```

Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

### 3. Install Python Dependencies

```powershell
pip install -e ".[dev]"
```

### 4. Configure Environment Variables

Create your local environment file:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the required values.

```env
SECRET_KEY=your-secure-random-secret
DATABASE_URL=postgresql+psycopg2://postgres:YOUR_PASSWORD@localhost:5432/YOUR_DATABASE_NAME
```

Also configure the Gemini API key, email provider credentials, and other required application settings according to `.env.example` and the project documentation.

**Security:** Never commit `.env` or expose API keys, database passwords, or authentication secrets in your GitHub repository.

### 5. Prepare the Database

Create your PostgreSQL database if it does not already exist.

Then run:

```powershell
alembic upgrade head
```

This applies the database migrations.

### 6. Create the Admin Account

Run:

```powershell
python -m scripts.create_admin --email you@example.com
```

The application will prompt you to enter an administrator password of at least 12 characters.

### 7. Start the Application

```powershell
uvicorn app.main:app --reload
```

The application should now be accessible locally.

---

## Application URLs

| Interface | URL |
|---|---|
| Public Portfolio | http://localhost:8000 |
| Admin Dashboard | http://localhost:8000/admin |
| API Documentation | http://localhost:8000/api/v1/docs |

*API documentation is intended for development and should remain disabled or protected in production.*

---

## Testing

The project includes backend and frontend automated tests.

### Backend Tests

Run:

```powershell
pytest
```

The implementation report originally recorded 73 backend tests.

### Frontend Tests

Install Node.js dependencies:

```powershell
npm install
```

Run:

```powershell
npm test
```

The implementation report originally recorded 21 frontend tests, including admin, public boot, and static-host deployment checks.

### Code Quality

Run Ruff:

```powershell
ruff check .
```

**Note:** Test counts describe the implementation report and should be verified against the current repository before treating them as the latest test results.

---

## Deployment

The project provides a separate static-ready frontend deployment directory.

### Frontend Deployment

The ready-to-deploy folder is:

```text
vercel-site/
```

For Vercel:

1. Import the GitHub repository.
2. Set the Vercel Root Directory to `vercel-site/`.
3. Configure the appropriate framework and build settings.
4. Deploy the project.

The static portfolio can display its public-facing content without a connected backend, subject to the implemented static-site configuration.

### Backend Deployment

The FastAPI backend requires a Python-compatible hosting environment.

Configure:

- PostgreSQL database connection.
- Environment variables.
- Gemini API credentials.
- Email provider credentials.
- Application startup command.
- Database migrations.

Run migrations during deployment:

```bash
alembic upgrade head
```

Consult the deployment guide for the complete instructions.

**Important:** Deploying the static frontend to Vercel does not automatically deploy the FastAPI backend, admin functionality, chatbot API, or contact email processing.

For the full-stack experience, deploy the backend separately and configure the frontend to communicate with its public API endpoint.

---

## Documentation

Detailed project documentation is available in the `docs/` directory.

| Document | Description |
|---|---|
| [Architecture](docs/ARCHITECTURE.md) | Application architecture and system design |
| [Security](docs/SECURITY.md) | Security practices and configuration |
| [Deployment](docs/DEPLOYMENT.md) | Frontend and backend deployment |
| [Email Setup](docs/EMAIL_SETUP.md) | Contact email configuration |
| [Admin Guide](docs/ADMIN_GUIDE.md) | Managing the portfolio through the CMS |
| [Migration Guide](docs/MIGRATION_FROM_EXISTING_SITE.md) | Migration from the previous portfolio |
| [Implementation Report](docs/IMPLEMENTATION_REPORT.md) | Implemented features and known limitations |

---

## Admin Content Management Guide

The admin dashboard provides centralized management of the portfolio.

| Requirement | Admin Section |
|---|---|
| Update portfolio content | Website Content |
| Customize themes and animations | Design & Animation |
| Add or edit projects | Projects |
| Upload profile and project images | Media Library |
| Upload CV / Resume | Media Library |
| Review contact submissions | Messages |
| Retry failed email notifications | Messages |
| Configure AI chatbot | Chatbot |

Only published projects and content are included in the chatbot's knowledge base.

---

## Security Considerations

- Keep environment variables and credentials private.
- Never upload `.env` to GitHub.
- Use strong administrator passwords.
- Use HTTPS in production.
- Restrict access to administrative endpoints.
- Configure production database credentials securely.
- Keep development API documentation disabled in production.
- Review `docs/SECURITY.md` before deployment.

---

## Future Improvements

Potential areas for future development include:

- Advanced RAG-based chatbot retrieval.
- More AI-powered portfolio interactions.
- Enhanced voice assistant capabilities.
- Analytics dashboard for visitor engagement.
- Advanced chatbot conversation management.
- Additional portfolio customization options.
- Subscription-based premium features.
- Improved monitoring and production observability.

These are potential enhancements, not claims about currently implemented functionality.

---

## Author

**Waheed Abbas**

AI Engineer | AI Agents | Agentic AI | AI Automation | Full-Stack Development

This project showcases the integration of modern web technologies, backend engineering, database management, interactive 3D experiences, and generative AI into a unified portfolio application.

---

## License

Unless a license is added to the repository, all rights are reserved by the project owner. No permission to redistribute or reuse the project should be assumed.

---

<p align="center">
  <strong>Built with passion for AI, innovation, and engineering.</strong>
</p>

<p align="center">
  © Waheed Abbas. All Rights Reserved.
</p>