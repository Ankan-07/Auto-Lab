import pandas as pd
import numpy as np
from sklearn.model_selection import (
    train_test_split, RandomizedSearchCV,
    StratifiedKFold, KFold
)
from sklearn.preprocessing import (
    LabelEncoder, StandardScaler,
    RobustScaler, PolynomialFeatures
)
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
    ExtraTreesClassifier, ExtraTreesRegressor,
    AdaBoostClassifier, AdaBoostRegressor,
)
from sklearn.linear_model import (
    LogisticRegression, LinearRegression,
    Ridge, Lasso, ElasticNet
)
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.feature_selection import (
    SelectKBest, f_classif, f_regression
)
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    r2_score, mean_squared_error, mean_absolute_error
)
import xgboost as xgb
import lightgbm as lgb
import warnings
warnings.filterwarnings('ignore')


def detect_problem_type(y: pd.Series) -> str:
    unique_ratio = y.nunique() / len(y)
    if y.dtype == 'object' or y.nunique() <= 10:
        return "classification"
    elif unique_ratio < 0.05:
        return "classification"
    else:
        return "regression"


def clean_data(
    df: pd.DataFrame,
    target_column: str,
    log_callback=None
) -> pd.DataFrame:
    original_rows = len(df)
    if log_callback:
        log_callback(f"Starting data cleaning... ({original_rows} rows, {len(df.columns)} columns)")

    df = df.drop_duplicates()
    removed_dups = original_rows - len(df)
    if removed_dups > 0 and log_callback:
        log_callback(f"Removed {removed_dups} duplicate rows")

    null_before = df.isnull().sum().sum()
    for col in df.columns:
        if df[col].isnull().sum() > 0:
            if df[col].dtype == 'object':
                df[col] = df[col].fillna(df[col].mode()[0])
            else:
                df[col] = df[col].fillna(df[col].median())
    if null_before > 0 and log_callback:
        log_callback(f"Filled {null_before} missing values using median/mode strategy")

    encoded_cols = []
    for col in df.columns:
        if col != target_column and df[col].dtype == 'object':
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            encoded_cols.append(col)

    if encoded_cols and log_callback:
        log_callback(f"Encoded {len(encoded_cols)} categorical columns: {', '.join(encoded_cols)}")

    if df[target_column].dtype == 'object':
        le = LabelEncoder()
        df[target_column] = le.fit_transform(df[target_column].astype(str))
        if log_callback:
            log_callback(f"Encoded target column: {target_column}")

    if log_callback:
        log_callback(f"Data cleaning complete ✓ ({len(df)} rows remaining)")

    return df


def engineer_features(
    df: pd.DataFrame,
    target_column: str,
    problem_type: str,
    dataset_size: int,
    log_callback=None
) -> pd.DataFrame:
    if log_callback:
        log_callback("Starting feature engineering...")

    X = df.drop(columns=[target_column])
    y = df[target_column]
    numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()

    if dataset_size < 5000 and len(numeric_cols) > 0:
        before = len(X)
        Q1  = X[numeric_cols].quantile(0.25)
        Q3  = X[numeric_cols].quantile(0.75)
        IQR = Q3 - Q1
        mask = ~((X[numeric_cols] < (Q1 - 3 * IQR)) |
                 (X[numeric_cols] > (Q3 + 3 * IQR))).any(axis=1)
        X = X[mask]
        y = y[mask]
        removed = before - len(X)
        if removed > 0 and log_callback:
            log_callback(f"Removed {removed} extreme outlier rows (3×IQR threshold)")

    if len(numeric_cols) > 2:
        corr_matrix = X[numeric_cols].corr().abs()
        upper = corr_matrix.where(
            np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
        )
        to_drop = [col for col in upper.columns if any(upper[col] > 0.95)]
        if to_drop:
            X = X.drop(columns=to_drop)
            if log_callback:
                log_callback(f"Removed {len(to_drop)} highly correlated features: {', '.join(to_drop)}")

    if dataset_size < 2000 and len(X.columns) <= 10:
        try:
            poly = PolynomialFeatures(
                degree=2, interaction_only=True, include_bias=False
            )
            current_numeric = X.select_dtypes(include=[np.number]).columns.tolist()
            poly_arr  = poly.fit_transform(X[current_numeric])
            n_new     = poly_arr.shape[1] - len(current_numeric)
            poly_cols = [f"poly_{i}" for i in range(n_new)]
            poly_df   = pd.DataFrame(
                poly_arr[:, len(current_numeric):],
                columns=poly_cols,
                index=X.index
            )
            X = pd.concat([X.reset_index(drop=True), poly_df.reset_index(drop=True)], axis=1)
            if log_callback:
                log_callback(f"Added {n_new} polynomial interaction features")
        except Exception:
            pass

    transformed = []
    for col in numeric_cols:
        if col in X.columns:
            skewness = X[col].skew()
            if abs(skewness) > 1.5 and X[col].min() >= 0:
                X[col] = np.log1p(X[col])
                transformed.append(col)
    if transformed and log_callback:
        log_callback(f"Log-transformed {len(transformed)} skewed features: {', '.join(transformed)}")

    if problem_type == "classification":
        class_counts    = y.value_counts()
        imbalance_ratio = class_counts.max() / class_counts.min()
        if imbalance_ratio > 3:
            try:
                from imblearn.over_sampling import SMOTE
                sm        = SMOTE(random_state=42)
                X_r, y_r  = sm.fit_resample(X, y)
                X = pd.DataFrame(X_r, columns=X.columns)
                y = pd.Series(y_r, name=target_column)
                if log_callback:
                    log_callback(
                        f"Applied SMOTE to fix class imbalance "
                        f"(ratio was {imbalance_ratio:.1f}:1)"
                    )
            except ImportError:
                if log_callback:
                    log_callback("Class imbalance detected — install imbalanced-learn to enable SMOTE")

    if len(X.columns) > 20:
        try:
            k           = min(20, len(X.columns))
            selector_fn = f_classif if problem_type == "classification" else f_regression
            selector    = SelectKBest(selector_fn, k=k)
            X_sel       = selector.fit_transform(X, y)
            sel_cols    = X.columns[selector.get_support()].tolist()
            X = pd.DataFrame(X_sel, columns=sel_cols)
            if log_callback:
                log_callback(f"Selected top {k} features using statistical F-test")
        except Exception:
            pass

    if log_callback:
        log_callback(f"Feature engineering complete ✓ ({len(X.columns)} features ready)")

    df_out = X.copy()
    df_out[target_column] = y.values
    return df_out


def get_classifiers(dataset_size: int) -> dict:
    models = {
        "Random Forest": RandomForestClassifier(
            n_estimators=200,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        ),
        "XGBoost": xgb.XGBClassifier(
            n_estimators=200,
            learning_rate=0.1,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            eval_metric='logloss',
            verbosity=0
        ),
        "LightGBM": lgb.LGBMClassifier(
            n_estimators=200,
            learning_rate=0.1,
            num_leaves=31,
            random_state=42,
            verbose=-1
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=200,
            learning_rate=0.1,
            max_depth=5,
            subsample=0.8,
            random_state=42
        ),
        "Extra Trees": ExtraTreesClassifier(
            n_estimators=200,
            random_state=42,
            n_jobs=-1
        ),
        "Logistic Regression": LogisticRegression(
            C=1.0,
            max_iter=1000,
            class_weight='balanced',
            random_state=42
        ),
        "KNN": KNeighborsClassifier(
            n_neighbors=7,
            weights='distance'
        ),
        "Naive Bayes": GaussianNB(),
    }

    if dataset_size < 5000:
        models["SVM (RBF)"] = SVC(
            kernel='rbf', C=1.0,
            gamma='scale', probability=True,
            random_state=42
        )
        models["AdaBoost"] = AdaBoostClassifier(
            n_estimators=100,
            learning_rate=0.1,
            random_state=42
        )

    return models


def get_regressors(dataset_size: int) -> dict:
    models = {
        "Random Forest": RandomForestRegressor(
            n_estimators=200, random_state=42, n_jobs=-1
        ),
        "XGBoost": xgb.XGBRegressor(
            n_estimators=200, learning_rate=0.1,
            max_depth=6, subsample=0.8,
            colsample_bytree=0.8,
            random_state=42, verbosity=0
        ),
        "LightGBM": lgb.LGBMRegressor(
            n_estimators=200, learning_rate=0.1,
            num_leaves=31, random_state=42, verbose=-1
        ),
        "Gradient Boosting": GradientBoostingRegressor(
            n_estimators=200, learning_rate=0.1,
            max_depth=5, subsample=0.8, random_state=42
        ),
        "Extra Trees": ExtraTreesRegressor(
            n_estimators=200, random_state=42, n_jobs=-1
        ),
        "Ridge": Ridge(alpha=1.0),
        "Lasso": Lasso(alpha=0.1, max_iter=2000),
        "ElasticNet": ElasticNet(
            alpha=0.1, l1_ratio=0.5, max_iter=2000
        ),
        "KNN": KNeighborsRegressor(
            n_neighbors=7, weights='distance'
        ),
    }

    if dataset_size < 5000:
        models["SVR"]      = SVR(kernel='rbf', C=1.0, gamma='scale')
        models["AdaBoost"] = AdaBoostRegressor(
            n_estimators=100, learning_rate=0.1, random_state=42
        )

    return models


def get_tuning_params(problem_type: str) -> dict:
    if problem_type == "classification":
        return {
            "Random Forest": {
                "n_estimators":      [100, 200, 300, 500],
                "max_depth":         [None, 5, 10, 20, 30],
                "min_samples_split": [2, 5, 10],
                "min_samples_leaf":  [1, 2, 4],
                "max_features":      ['sqrt', 'log2', None],
                "class_weight":      ['balanced', None],
            },
            "XGBoost": {
                "n_estimators":     [100, 200, 300],
                "learning_rate":    [0.01, 0.05, 0.1, 0.2],
                "max_depth":        [3, 4, 5, 6, 8],
                "subsample":        [0.6, 0.7, 0.8, 0.9, 1.0],
                "colsample_bytree": [0.6, 0.7, 0.8, 0.9, 1.0],
                "reg_alpha":        [0, 0.1, 0.5, 1.0],
                "reg_lambda":       [0.5, 1.0, 2.0],
            },
            "LightGBM": {
                "n_estimators":      [100, 200, 300],
                "learning_rate":     [0.01, 0.05, 0.1, 0.2],
                "num_leaves":        [15, 31, 63, 127],
                "min_child_samples": [5, 10, 20, 50],
                "subsample":         [0.6, 0.8, 1.0],
                "colsample_bytree":  [0.6, 0.8, 1.0],
            },
            "Gradient Boosting": {
                "n_estimators":      [100, 200, 300],
                "learning_rate":     [0.01, 0.05, 0.1, 0.2],
                "max_depth":         [3, 4, 5, 6],
                "subsample":         [0.6, 0.7, 0.8, 0.9],
                "min_samples_split": [2, 5, 10],
            },
            "Extra Trees": {
                "n_estimators":      [100, 200, 300],
                "max_depth":         [None, 5, 10, 20],
                "min_samples_split": [2, 5, 10],
                "min_samples_leaf":  [1, 2, 4],
                "max_features":      ['sqrt', 'log2'],
            },
        }
    else:
        return {
            "Random Forest": {
                "n_estimators":      [100, 200, 300, 500],
                "max_depth":         [None, 5, 10, 20, 30],
                "min_samples_split": [2, 5, 10],
                "min_samples_leaf":  [1, 2, 4],
                "max_features":      ['sqrt', 'log2', None],
            },
            "XGBoost": {
                "n_estimators":     [100, 200, 300],
                "learning_rate":    [0.01, 0.05, 0.1, 0.2],
                "max_depth":        [3, 4, 5, 6, 8],
                "subsample":        [0.6, 0.7, 0.8, 0.9],
                "colsample_bytree": [0.6, 0.7, 0.8, 0.9],
            },
            "LightGBM": {
                "n_estimators":      [100, 200, 300],
                "learning_rate":     [0.01, 0.05, 0.1, 0.2],
                "num_leaves":        [15, 31, 63, 127],
                "min_child_samples": [5, 10, 20, 50],
            },
            "Gradient Boosting": {
                "n_estimators":      [100, 200, 300],
                "learning_rate":     [0.01, 0.05, 0.1, 0.2],
                "max_depth":         [3, 4, 5, 6],
                "subsample":         [0.6, 0.7, 0.8, 0.9],
                "min_samples_split": [2, 5, 10],
            },
            "Extra Trees": {
                "n_estimators":      [100, 200, 300],
                "max_depth":         [None, 5, 10, 20],
                "min_samples_split": [2, 5, 10],
                "min_samples_leaf":  [1, 2, 4],
                "max_features":      ['sqrt', 'log2'],
            },
        }


def train_models(
    df: pd.DataFrame,
    target_column: str,
    problem_type: str,
    dataset_size: int,
    log_callback=None
) -> list:
    X = df.drop(columns=[target_column])
    y = df[target_column]

    scaler   = RobustScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y,
        test_size=0.2,
        random_state=42,
        stratify=y if problem_type == "classification" else None
    )

    if log_callback:
        log_callback(f"Train: {len(X_train)} rows | Test: {len(X_test)} rows")

    models  = get_classifiers(dataset_size) if problem_type == "classification" \
              else get_regressors(dataset_size)
    results = []

    for name, model in models.items():
        try:
            if log_callback:
                log_callback(f"⟳ Training {name}...")

            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)

            if problem_type == "classification":
                accuracy  = accuracy_score(y_test, y_pred)
                f1        = f1_score(y_test, y_pred, average='weighted', zero_division=0)
                precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
                recall    = recall_score(y_test, y_pred, average='weighted', zero_division=0)
                metrics = {
                    "accuracy":  round(float(accuracy), 4),
                    "f1_score":  round(float(f1), 4),
                    "precision": round(float(precision), 4),
                    "recall":    round(float(recall), 4),
                }
                primary_score = accuracy

            else:
                r2   = r2_score(y_test, y_pred)
                rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
                mae  = float(mean_absolute_error(y_test, y_pred))
                metrics = {
                    "r2_score": round(float(r2), 4),
                    "rmse":     round(rmse, 4),
                    "mae":      round(mae, 4),
                }
                primary_score = r2

            results.append({
                "model_name":    name,
                "metrics":       metrics,
                "primary_score": primary_score,
                "tuned":         False,
            })

            if log_callback:
                log_callback(f"  ✓ {name}: {primary_score:.4f}")

        except Exception as e:
            if log_callback:
                log_callback(f"  ✗ {name}: skipped ({str(e)})")

    results.sort(key=lambda x: x["primary_score"], reverse=True)
    return results


def tune_top_models(
    df: pd.DataFrame,
    target_column: str,
    problem_type: str,
    initial_results: list,
    dataset_size: int,
    log_callback=None
) -> list:
    if log_callback:
        log_callback("Starting hyperparameter tuning for top 5 models...")

    X = df.drop(columns=[target_column])
    y = df[target_column]

    scaler   = RobustScaler()
    X_scaled = scaler.fit_transform(X)

    if dataset_size < 1000:
        n_iter = 30
    elif dataset_size < 5000:
        n_iter = 20
    elif dataset_size < 10000:
        n_iter = 10
    else:
        n_iter = 5

    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42) \
         if problem_type == "classification" \
         else KFold(n_splits=3, shuffle=True, random_state=42)

    scoring       = "accuracy" if problem_type == "classification" else "r2"
    tuning_params = get_tuning_params(problem_type)

    top_5        = [r["model_name"] for r in initial_results[:5]]
    tuned_lookup = {r["model_name"]: r for r in initial_results}

    models = get_classifiers(dataset_size) if problem_type == "classification" \
             else get_regressors(dataset_size)

    for model_name in top_5:
        if model_name not in tuning_params:
            if log_callback:
                log_callback(f"  Skipping {model_name} (no search space defined)")
            continue

        if log_callback:
            log_callback(f"⟳ Tuning {model_name} ({n_iter} random iterations)...")

        try:
            search = RandomizedSearchCV(
                models[model_name],
                param_distributions=tuning_params[model_name],
                n_iter=n_iter,
                scoring=scoring,
                cv=cv,
                random_state=42,
                n_jobs=-1,
                refit=True
            )
            search.fit(X_scaled, y)

            best_score  = search.best_score_
            old_score   = tuned_lookup[model_name]["primary_score"]
            improvement = best_score - old_score

            if best_score > old_score:
                tuned_lookup[model_name]["primary_score"] = round(float(best_score), 4)
                tuned_lookup[model_name]["tuned"]         = True
                tuned_lookup[model_name]["best_params"]   = search.best_params_
                if log_callback:
                    log_callback(
                        f"  ✓ {model_name}: {old_score:.4f} → "
                        f"{best_score:.4f} (+{improvement:.4f})"
                    )
            else:
                if log_callback:
                    log_callback(f"  ✓ {model_name}: original params already optimal")

        except Exception as e:
            if log_callback:
                log_callback(f"  ✗ {model_name} tuning failed: {str(e)}")

    final = list(tuned_lookup.values())
    final.sort(key=lambda x: x["primary_score"], reverse=True)
    return final


def get_feature_importance(
    df: pd.DataFrame,
    target_column: str,
    problem_type: str,
    log_callback=None
) -> list:
    try:
        X = df.drop(columns=[target_column])
        y = df[target_column]

        scaler   = RobustScaler()
        X_scaled = scaler.fit_transform(X)
        X_train, _, y_train, _ = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )

        model = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1) \
                if problem_type == "classification" \
                else RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)

        model.fit(X_train, y_train)

        importances = model.feature_importances_
        features    = X.columns.tolist()

        result = [
            {"feature": f, "importance": round(float(imp), 4)}
            for f, imp in zip(features, importances)
        ]
        result.sort(key=lambda x: x["importance"], reverse=True)

        if log_callback:
            log_callback("Feature importance calculated ✓")
            for f in result[:3]:
                log_callback(f"  → {f['feature']}: {f['importance']:.4f}")

        return result

    except Exception as e:
        if log_callback:
            log_callback(f"Feature importance failed: {str(e)}")
        return []


def run_full_pipeline(
    file_path: str,
    target_column: str,
    log_callback=None
) -> dict:

    if log_callback:
        log_callback("📂 Loading dataset...")
    df           = pd.read_csv(file_path)
    dataset_size = len(df)
    if log_callback:
        log_callback(f"Loaded {dataset_size} rows, {len(df.columns)} columns ✓")

    if log_callback:
        log_callback("🧹 Stage 1: Cleaning data...")
    df = clean_data(df, target_column, log_callback)

    problem_type = detect_problem_type(df[target_column])
    if log_callback:
        log_callback(f"🎯 Problem type: {problem_type.upper()} ✓")

    if log_callback:
        log_callback("⚙️ Stage 2: Feature engineering...")
    df = engineer_features(
        df, target_column, problem_type, dataset_size, log_callback
    )

    total = len(get_classifiers(dataset_size)) if problem_type == "classification" \
            else len(get_regressors(dataset_size))
    if log_callback:
        log_callback(f"🧠 Stage 3: Training {total} models...")
    model_results = train_models(
        df, target_column, problem_type, dataset_size, log_callback
    )

    if log_callback:
        log_callback("🔬 Stage 4: Hyperparameter tuning (top 5 models)...")
    model_results = tune_top_models(
        df, target_column, problem_type,
        model_results, dataset_size, log_callback
    )

    if log_callback:
        log_callback("📊 Stage 5: Calculating feature importance...")
    feature_importance = get_feature_importance(
        df, target_column, problem_type, log_callback
    )

    best = model_results[0]
    if log_callback:
        log_callback(
            f"🏆 Best model: {best['model_name']} — "
            f"{best['primary_score']:.4f}"
        )
        log_callback("🎉 Pipeline complete!")

    return {
        "problem_type":       problem_type,
        "best_model":         best["model_name"],
        "best_metrics":       best["metrics"],
        "all_models":         model_results,
        "feature_importance": feature_importance,
        "dataset_size":       dataset_size,
    }