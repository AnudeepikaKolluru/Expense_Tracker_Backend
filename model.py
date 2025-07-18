import joblib
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix

# Step 1: Load data
df = pd.read_csv("realistic_dataset.csv")

X = df["description"]
y = df["category"]

# Step 2: Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# Step 3: Define pipeline with Logistic Regression (updated solver)
pipeline = Pipeline([
    ('tfidf', TfidfVectorizer(ngram_range=(1, 2), stop_words='english', min_df=1)),
    ('clf', LogisticRegression(max_iter=1000, C=1.0, solver='lbfgs', multi_class='multinomial', random_state=42))
])

# Step 4: Train model
pipeline.fit(X_train, y_train)

# Step 5: Predict and evaluate
y_pred = pipeline.predict(X_test)
print("Classification Report:\n", classification_report(y_test, y_pred))
print("Accuracy:", accuracy_score(y_test, y_pred))

# Step 6: Confusion matrix
plt.figure(figsize=(14, 10))
cm = confusion_matrix(y_test, y_pred, labels=pipeline.classes_)
sns.heatmap(cm, annot=True, fmt="d", cmap="Greens", xticklabels=pipeline.classes_, yticklabels=pipeline.classes_)
plt.xlabel("Predicted")
plt.ylabel("Actual")
plt.title("Confusion Matrix")
plt.tight_layout()
plt.show()

# Step 7: Save model
joblib.dump(pipeline, 'expense_categorizer_logreg.pkl')
print(" Model saved as 'expense_categorizer_logreg.pkl'")

# Step 8: Cross-validation
scores = cross_val_score(pipeline, X, y, cv=5, scoring='accuracy')
print("Cross-validation scores:", scores)
print("Mean accuracy:", scores.mean())
