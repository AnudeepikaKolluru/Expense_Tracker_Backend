#  AI-Based Expense Tracker – Backend

This is the backend for the **AI-based Expense Tracker** web application.  
It supports expense recording, OCR-based bill scanning, AI-driven expense categorization, and chatbot interaction.

---

## Tech Stack


| Component    | Technology         |
|--------------|--------------------|
| Backend      | Node.js + Express  |
| OCR Service  | Python + Flask + Tesseract |
| AI Categorization | Python + Flask + Scikit-learn |
| Database     | PostgreSQL (via Render) |
| Chatbot      | Dialogflow Messenger |
| Frontend     | HTML, JS (GitHub Pages) |


---

## Folder Structure
```text
backend/
├── server.js # Node.js backend (Express)
├── ocr_server.py # OCR service (Flask)
├── api.py # AI categorization API (Flask)
├── model.py # ML utility functions
├── requirements.txt # Python dependencies
├── package.json # Node.js dependencies
├── render.yaml # Render deployment config (multi-service)
```
---
## Deployment (Render)
This project uses Render for hosting multiple services:
1.Node.js
2.OCR Service (Docker)
3.ML API (Docker)
---
## Dialogflow Chatbot Integration

This project supports a smart conversational interface using **Dialogflow**, allowing users to interact with the Expense Tracker via natural language.

###  Supported Intents

| Intent Name             | Description |
|-------------------------|-------------|
| **Add Expense**         | Add a new expense via chat (e.g., "I spent 200 on food"). |
| **Add Participants**    | Add participants to a group. |
| **Get Balance**         | Get overall balance among all participants. |
| **Get Person Balance**  | Check how much a specific user owes or is owed. |
| **Get Monthly Expenses**| Get total expenses for a given month. |
| **Get Expenses By Date**| View expenses recorded on a specific date. |
| **Get Expenses By Category** | Retrieve expenses under a specific category (e.g., "food", "travel"). |
| **Today Expenses**      | Get all expenses recorded today. |
| **Show Participants**   | Display all current participants in a group. |
| **Default Welcome Intent** | Greet user when the chatbot is started. |
| **Default Fallback Intent**| Handles unrecognized queries gracefully. |

>  These intents are linked to webhook functions already implemented in `server.js`, which route the request to appropriate database or ML-powered services (like `api.py` or `ocr_server.py`).
>  You can create more intents to add more functionalities.
>  Each intent has training phrases defined to capture various ways users might express their intent naturally.


### Want to Use It?
> You can create your own Dialogflow agent and connect it to this backend or your custom deployment.
>  Viewers can **create their own Dialogflow agent** and **replicate the intents** listed above using training phrases.
> This modularity allows you to connect the chatbot to your own backend or the existing hosted one.


## Frontend Link

The frontend is deployed using GitHub Pages:

🔗 **Live Demo:** [Expense Tracker Frontend](https://anudeepikakolluru.github.io/Expense_Tracker_Frontend/)

---

##  AI Features

- Bills are scanned using OCR (`ocr_server.py`)
- Data is categorized using a trained ML model (`api.py`)
- Chatbot (Dialogflow) allows users to interact with the app naturally
