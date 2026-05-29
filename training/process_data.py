import pandas as pd
import numpy as np
import time

import matplotlib
matplotlib.use("Agg")
from matplotlib import pyplot as plt

from sentence_transformers import SentenceTransformer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer

from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier

from sklearn.metrics import (
    confusion_matrix,
    ConfusionMatrixDisplay,
    accuracy_score,
    f1_score
)
import joblib


# =========================================================
# DATA SPLIT
# =========================================================

def split_dataset(path):
    df = pd.read_csv(path)

    X = df["text"]
    y = df["label"]

    print("\nTOTAL LABEL COUNTS:")
    print(y.value_counts())

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )

    print("\nTRAIN LABEL COUNTS:")
    print(y_train.value_counts())

    print("\nTEST LABEL COUNTS:")
    print(y_test.value_counts())

    pd.DataFrame({
        "sentence": X_train,
        "sentiment": y_train
    }).to_csv("train.csv", index=False)

    pd.DataFrame({
        "sentence": X_test,
        "sentiment": y_test
    }).to_csv("test.csv", index=False)


# =========================================================
# LOAD DATA
# =========================================================

def get_train_test(pathTrain, pathTest):
    train = pd.read_csv(pathTrain)
    test = pd.read_csv(pathTest)

    return (
        train["sentence"].values,
        test["sentence"].values,
        train["sentiment"].values,
        test["sentiment"].values
    )


# =========================================================
# CREATE EMBEDDINGS
# =========================================================

def create_embeddings(X_train, X_test):
    print("\nGenerating sentence embeddings...")
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    start = time.time()

    X_train_emb = embedder.encode(X_train.tolist(), show_progress_bar=True)
    X_test_emb = embedder.encode(X_test.tolist(), show_progress_bar=True)

    embedding_time = time.time() - start
    print(f"\nEmbedding generation time: {embedding_time:.2f}s")

    np.save("embeddings/X_train_emb.npy", X_train_emb)
    np.save("embeddings/X_test_emb.npy", X_test_emb)
    
    X_train_emb = np.load('embeddings/X_train_emb.npy')
    X_test_emb = np.load('embeddings/X_test_emb.npy')

    return X_train_emb, X_test_emb


# =========================================================
# PLOT CORRELATION MATRICES
# =========================================================

def save_confusion_matrix(y_test, y_pred, labels, model_name):
    cm = confusion_matrix(y_test, y_pred, labels=labels)
    _, ax = plt.subplots(figsize=(7, 6))

    disp = ConfusionMatrixDisplay(
        confusion_matrix=cm,
        display_labels=labels
    )
    disp.plot(cmap="Blues", ax=ax, colorbar=False)

    ax.set_title(model_name, fontsize=14, pad=15)
    ax.set_xlabel("Predicted Label", fontsize=12)
    ax.set_ylabel("True Label", fontsize=12)

    filename = (
        model_name.lower()
        .replace(" ", "_")
        .replace("(", "")
        .replace(")", "")
    )
    plt.savefig(
        f"plots/{filename}.png",
        dpi=300,
        bbox_inches="tight"
    )
    plt.close()


# =========================================================
# EVALUATION FUNCTION
# =========================================================

def evaluate_model(
    name, model,
    X_train, X_test,
    y_train, y_test,
    labels
):
    # TRAINING TIME
    start = time.time()
    model.fit(X_train, y_train)
    train_time = time.time() - start

    # PREDICTION TIME
    start = time.time()
    y_pred = model.predict(X_test)
    pred_time = time.time() - start

    # METRICS
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="macro")

    # CORRELATION MATRIX PLOT
    save_confusion_matrix(y_test, y_pred, labels, name)

    return {
        "Model": name,
        "Accuracy": acc,
        "Macro F1": f1,
        "Train Time (s)": train_time,
        "Predict Time (s)": pred_time
    }


# =========================================================
# TF-IDF ANALYSIS
# =========================================================

def perform_tfidf_analysis():
    X_train, X_test, y_train, y_test = get_train_test("train.csv", "test.csv")

    labels = ["NEGATIVE", "NEUTRAL", "POSITIVE"]
    models = {
        "Naive Bayes (TF-IDF)": MultinomialNB(),
        "Logistic Regression (TF-IDF)": LogisticRegression(
            max_iter=1000,
            class_weight="balanced"
        ),
        "Linear SVM (TF-IDF)": LinearSVC(
            class_weight="balanced"
        ),
        "Random Forest (TF-IDF)": RandomForestClassifier(
            n_estimators=200,
            random_state=42,
            n_jobs=-1,
            class_weight="balanced"
        )
    }

    results = []
    for name, clf in models.items():
        model = Pipeline([
            ("tfidf", TfidfVectorizer(stop_words="english")),
            ("clf", clf)
        ])

        result = evaluate_model(
            name, model,
            X_train, X_test,
            y_train, y_test,
            labels
        )
        results.append(result)

    # FINAL RESULTS
    df_results = pd.DataFrame(results)
    print("\n================ TF-IDF FINAL COMPARISON ================")
    print(df_results.sort_values(
        "Macro F1",
        ascending=False
    ))


# =========================================================
# EMBEDDING ANALYSIS
# =========================================================

def perform_embedding_analysis():
    X_train, X_test, y_train, y_test = get_train_test("train.csv", "test.csv")

    labels = ["NEGATIVE", "NEUTRAL", "POSITIVE"]
    # GENERATE EMBEDDINGS
    X_train_emb, X_test_emb = create_embeddings(X_train, X_test)

    # REMOVE FROM HERE FOR SAVING EMBEDDINGS
    models = {
        "Logistic Regression (Embeddings)": LogisticRegression(
            max_iter=1000,
            class_weight="balanced"
        ),
        "Linear SVM (Embeddings)": LinearSVC(
            class_weight="balanced"
        ),
        "Random Forest (Embeddings)": RandomForestClassifier(
            n_estimators=200,
            random_state=42,
            n_jobs=-1,
            class_weight="balanced"
        )
    }

    results = []
    for name, clf in models.items():
        result = evaluate_model(
            name, clf,
            X_train_emb, X_test_emb,
            y_train, y_test,
            labels
        )
        results.append(result)

    # FINAL RESULTS
    df_results = pd.DataFrame(results)
    print("\n================ EMBEDDING FINAL COMPARISON ================")
    print(df_results.sort_values("Macro F1", ascending=False))


def export():
    best_model = LinearSVC(
        class_weight="balanced"
    )

    X_train_emb = np.load('embeddings/X_train_emb.npy')
    _, _, y_train, _ = get_train_test("train.csv", "test.csv")

    best_model.fit(X_train_emb, y_train)
    joblib.dump(best_model, "linear_svm_embeddings.pkl")

    metadata = {
        "embedding_model": "all-MiniLM-L6-v2",
        "labels": ["NEGATIVE", "NEUTRAL", "POSITIVE"]
    }
    joblib.dump(metadata, "model_metadata.pkl")


# CREATE TRAIN / TEST SPLIT
split_dataset("dataset.csv")

# RUN TF-IDF EXPERIMENTS
perform_tfidf_analysis()

# RUN EMBEDDING EXPERIMENTS
perform_embedding_analysis()

# EXPORTING DATA
export()