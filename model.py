import joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import classification_report

data = [
    ("Uber to office", "Travel"),
    ("Booked a cab to airport", "Travel"),
    ("Flight to Mumbai", "Travel"),
    ("Train to Delhi", "Travel"),
    ("Taxi from home to station", "Travel"),
    ("Ola ride from airport", "Travel"),
    ("Booked bus ticket", "Travel"),

    ("Domino's Pizza dinner", "Food"),
    ("Zomato lunch", "Food"),
    ("Swiggy breakfast", "Food"),

    ("Bought tomatoes and onions", "Groceries"),
    ("Kirana store visit", "Groceries"),
    ("Daily vegetable purchase", "Groceries"),

    ("Netflix subscription", "Entertainment"),
    ("Cinema ticket", "Entertainment"),
    ("Spotify Premium", "Entertainment"),

    ("Paid electricity bill", "Utilities"),
    ("Monthly water bill", "Utilities"),
    ("Recharged WiFi", "Utilities"),
    ("Paid mobile bill", "Utilities"),

    ("Bought a new shirt", "Shopping"),
    ("New sneakers", "Shopping"),

    ("Ordered a new laptop", "Electronics"),
    ("Fridge repair", "Electronics"),
    ("Bought headphones", "Electronics"),

    ("Lipstick and lotion", "Beauty Products"),
    ("Bought shampoo and facewash", "Beauty Products")
]

df = pd.DataFrame(data, columns=["description", "category"])


X_train, X_test, y_train, y_test = train_test_split(df["description"], df["category"], test_size=0.2, random_state=42)

pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(ngram_range=(1, 2), stop_words='english')),
    ('clf', RandomForestClassifier(n_estimators=100, random_state=42))
])

pipeline.fit(X_train, y_train)


y_pred = pipeline.predict(X_test)
print("Classification Report:\n", classification_report(y_test, y_pred))


joblib.dump(pipeline, 'expense_categorizer_rf.pkl')
print("Model saved as 'expense_categorizer_rf.pkl'")