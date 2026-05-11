import pandas as pd
import numpy as np
from sklearn.model_selection import (
    train_test_split, RandomizedSearchCV,
    StratifiedKFold, KFold
)
from sklearn.preprocessing import (
    LabelEncoder, RobustScaler, PolynomialFeatures
)
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
    ExtraTreesClassifier, ExtraTreesRegressor,
    AdaBoostClassifier, AdaBoostRegressor,
)
from sklearn.linear_model import (
    LogisticRegression, Ridge, Lasso, ElasticNet
)
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.feature_selection import SelectKBest, f_classif, f_regression
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    r2_score, mean_squared_error, mean_absolute_error, confusion_matrix
)
import xgboost as xgb
import lightgbm as lgb
import warnings
warnings.filterwarnings('ignore')

from ml.agent_state import AgentState


def _log(state: AgentState, message: str):
    """Appends message to logs and calls real-time callback."""
    state["logs"].append(message)
    if state.get("log_callback"):
        state["log_callback"](message)


# ═══════════════════════════════════════════════════
# SHARED HELPERS
# ═══════════════════════════════════════════════════

def _get_models(problem_type: str, dataset_size: int) -> dict:
    if problem_type == "classification":
        models = {
            "Random Forest":       RandomForestClassifier(
                n_estimators=200, class_weight='balanced',
                random_state=42, n_jobs=-1
            ),
            "XGBoost":             xgb.XGBClassifier(
                n_estimators=200, learning_rate=0.1, max_depth=6,
                subsample=0.8, colsample_bytree=0.8,
                random_state=42, eval_metric='logloss', verbosity=0
            ),
            "LightGBM":            lgb.LGBMClassifier(
                n_estimators=200, learning_rate=0.1, num_leaves=31,
                random_state=42, verbose=-1
            ),
            "Gradient Boosting":   GradientBoostingClassifier(
                n_estimators=200, learning_rate=0.1,
                max_depth=5, random_state=42
            ),
            "Extra Trees":         ExtraTreesClassifier(
                n_estimators=200, random_state=42, n_jobs=-1
            ),
            "Logistic Regression": LogisticRegression(
                C=1.0, max_iter=1000,
                class_weight='balanced', random_state=42
            ),
            "KNN":                 KNeighborsClassifier(
                n_neighbors=7, weights='distance'
            ),
            "Naive Bayes":         GaussianNB(),
        }
        if dataset_size < 5000:
            models["SVM"]      = SVC(
                kernel='rbf', C=1.0, gamma='scale',
                probability=True, random_state=42
            )
            models["AdaBoost"] = AdaBoostClassifier(
                n_estimators=100, learning_rate=0.1, random_state=42
            )
    else:
        models = {
            "Random Forest":     RandomForestRegressor(
                n_estimators=200, random_state=42, n_jobs=-1
            ),
            "XGBoost":           xgb.XGBRegressor(
                n_estimators=200, learning_rate=0.1, max_depth=6,
                subsample=0.8, colsample_bytree=0.8,
                random_state=42, verbosity=0
            ),
            "LightGBM":          lgb.LGBMRegressor(
                n_estimators=200, learning_rate=0.1, num_leaves=31,
                random_state=42, verbose=-1
            ),
            "Gradient Boosting": GradientBoostingRegressor(
                n_estimators=200, learning_rate=0.1,
                max_depth=5, random_state=42
            ),
            "Extra Trees":       ExtraTreesRegressor(
                n_estimators=200, random_state=42, n_jobs=-1
            ),
            "Ridge":             Ridge(alpha=1.0),
            "Lasso":             Lasso(alpha=0.1, max_iter=2000),
            "ElasticNet":        ElasticNet(
                alpha=0.1, l1_ratio=0.5, max_iter=2000
            ),
            "KNN":               KNeighborsRegressor(
                n_neighbors=7, weights='distance'
            ),
        }
        if dataset_size < 5000:
            models["SVR"]      = SVR(kernel='rbf', C=1.0, gamma='scale')
            models["AdaBoost"] = AdaBoostRegressor(
                n_estimators=100, learning_rate=0.1, random_state=42
            )
    return models


def _get_tuning_params(problem_type: str) -> dict:
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


# ═══════════════════════════════════════════════════
# AGENT 1 — DATA CLEANER AGENT
# ═══════════════════════════════════════════════════

def data_cleaner_agent(state: AgentState) -> AgentState:
    _log(state, "🤖 DataCleanerAgent starting...")

    try:
        # Load CSV
        _log(state, f"📂 Loading dataset...")
        file_path = state["file_path"]
        lower_path = file_path.lower()
        if lower_path.endswith(".csv"):
            df = pd.read_csv(file_path)
        elif lower_path.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file_path)
        elif lower_path.endswith(".json"):
            df = pd.read_json(file_path)
        elif lower_path.endswith(".parquet"):
            df = pd.read_parquet(file_path)
        elif lower_path.endswith(".tsv"):
            df = pd.read_csv(file_path, sep="\t")
        else:
            df = pd.read_csv(file_path)
        state["raw_df"]       = df.copy()
        state["dataset_size"] = len(df)
        _log(state, f"Loaded {len(df)} rows, {len(df.columns)} columns ✓")

        target = state["target_column"]
        report = {
            "original_rows":      len(df),
            "duplicates_removed": 0,
            "nulls_filled":       0,
            "ohe_columns":        [],
            "label_columns":      [],
            "raw_feature_columns": [c for c in df.columns if c != target],
            "fill_values":         {},
            "feature_dtypes":      {},
            "ohe_categories":      {},
            "ohe_dummy_columns":   {},
            "label_classes":       {},
            "target_classes":      [],
            "cleaned_feature_columns": [],
        }

        # Detect problem type
        y            = df[target]
        unique_ratio = y.nunique() / len(y)
        if y.dtype == 'object' or y.nunique() <= 10:
            problem_type = "classification"
        elif unique_ratio < 0.05:
            problem_type = "classification"
        else:
            problem_type = "regression"

        state["problem_type"] = problem_type
        _log(state, f"🎯 Problem type: {problem_type.upper()} ✓")

        # Remove duplicates
        before = len(df)
        df     = df.drop_duplicates()
        removed = before - len(df)
        report["duplicates_removed"] = removed
        if removed > 0:
            _log(state, f"Removed {removed} duplicate rows")

        # Fill missing values
        null_count = int(df.isnull().sum().sum())
        report["nulls_filled"] = null_count
        for col in df.columns:
            if df[col].isnull().sum() > 0:
                if df[col].dtype == 'object':
                    fill_value = df[col].mode()[0]
                    report["fill_values"][col] = str(fill_value)
                    df[col] = df[col].fillna(fill_value)
                else:
                    fill_value = float(df[col].median())
                    report["fill_values"][col] = fill_value
                    df[col] = df[col].fillna(fill_value)
            elif col != target:
                if df[col].dtype == 'object':
                    report["fill_values"][col] = str(df[col].mode()[0]) if len(df[col].mode()) else ""
                else:
                    report["fill_values"][col] = float(df[col].median())
            if col != target:
                report["feature_dtypes"][col] = "categorical" if df[col].dtype == 'object' else "numeric"
        if null_count > 0:
            _log(state, f"Filled {null_count} missing values ✓")

        # Smart encoding
        cols_to_process = [
            c for c in df.columns
            if c != target and df[c].dtype == 'object'
        ]
        for col in cols_to_process:
            n_unique = df[col].nunique()
            if n_unique <= 10:
                # One Hot Encoding — no fake ordering
                dummies = pd.get_dummies(df[col], prefix=col, drop_first=True)
                report["ohe_categories"][col] = [str(v) for v in df[col].dropna().astype(str).unique().tolist()]
                report["ohe_dummy_columns"][col] = dummies.columns.tolist()
                df      = pd.concat([df.drop(columns=[col]), dummies], axis=1)
                report["ohe_columns"].append(col)
                _log(state, f"One-hot encoded: {col} ({n_unique} categories)")
            else:
                # Label Encoding — too many categories for OHE
                le      = LabelEncoder()
                df[col] = le.fit_transform(df[col].astype(str))
                report["label_columns"].append(col)
                report["label_classes"][col] = le.classes_.astype(str).tolist()
                _log(state, f"Label encoded: {col} ({n_unique} unique values)")

        # Encode target if needed
        if df[target].dtype == 'object':
            le         = LabelEncoder()
            df[target] = le.fit_transform(df[target].astype(str))
            report["target_classes"] = le.classes_.astype(str).tolist()
            _log(state, f"Encoded target column: {target}")

        report["final_rows"]    = len(df)
        report["final_columns"] = len(df.columns)
        report["cleaned_feature_columns"] = [c for c in df.columns if c != target]

        state["cleaned_df"]      = df
        state["cleaning_report"] = report

        _log(state, f"✓ DataCleanerAgent complete — {len(df)} rows, {len(df.columns)} columns")

    except Exception as e:
        state["error"] = f"DataCleanerAgent failed: {str(e)}"
        _log(state, f"✗ DataCleanerAgent error: {str(e)}")

    return state


# ═══════════════════════════════════════════════════
# AGENT 2 — FEATURE ENGINEER AGENT
# ═══════════════════════════════════════════════════

def feature_engineer_agent(state: AgentState) -> AgentState:
    if state.get("error"):
        return state

    _log(state, "🤖 FeatureEngineerAgent starting...")

    try:
        df           = state["cleaned_df"].copy()
        target       = state["target_column"]
        problem_type = state["problem_type"]
        dataset_size = state["dataset_size"]

        X            = df.drop(columns=[target])
        y            = df[target]
        numeric_cols = X.select_dtypes(include=[np.number]).columns.tolist()

        report = {
            "outliers_removed":    0,
            "correlated_dropped":  [],
            "polynomial_added":    0,
            "polynomial_input_columns": [],
            "polynomial_feature_names": [],
            "log_transformed":     [],
            "smote_applied":       False,
            "features_selected":   0,
            "selected_columns":     [],
            "final_feature_count": 0,
            "final_columns":        [],
        }

        # Step 1 — Remove outliers (small datasets only)
        if dataset_size < 5000 and len(numeric_cols) > 0:
            before = len(X)
            Q1  = X[numeric_cols].quantile(0.25)
            Q3  = X[numeric_cols].quantile(0.75)
            IQR = Q3 - Q1
            mask = ~(
                (X[numeric_cols] < (Q1 - 3 * IQR)) |
                (X[numeric_cols] > (Q3 + 3 * IQR))
            ).any(axis=1)
            X = X[mask]
            y = y[mask]
            removed = before - len(X)
            report["outliers_removed"] = removed
            if removed > 0:
                _log(state, f"Removed {removed} extreme outliers (3×IQR)")

        # Step 2 — Remove highly correlated features
        curr_numeric = X.select_dtypes(include=[np.number]).columns.tolist()
        if len(curr_numeric) > 2:
            corr_matrix = X[curr_numeric].corr().abs()
            upper = corr_matrix.where(
                np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
            )
            to_drop = [c for c in upper.columns if any(upper[c] > 0.95)]
            if to_drop:
                X = X.drop(columns=to_drop)
                report["correlated_dropped"] = to_drop
                _log(state, f"Dropped {len(to_drop)} correlated features: {', '.join(to_drop)}")

        # Step 3 — Polynomial features (tiny datasets only)
        if dataset_size < 2000 and len(X.columns) <= 10:
            try:
                curr_num = X.select_dtypes(include=[np.number]).columns.tolist()
                poly     = PolynomialFeatures(
                    degree=2, interaction_only=True, include_bias=False
                )
                poly_arr = poly.fit_transform(X[curr_num])
                n_new    = poly_arr.shape[1] - len(curr_num)
                poly_df  = pd.DataFrame(
                    poly_arr[:, len(curr_num):],
                    columns=[f"poly_{i}" for i in range(n_new)],
                    index=X.index
                )
                X = pd.concat(
                    [X.reset_index(drop=True), poly_df.reset_index(drop=True)],
                    axis=1
                )
                report["polynomial_added"] = n_new
                report["polynomial_input_columns"] = curr_num
                report["polynomial_feature_names"] = [f"poly_{i}" for i in range(n_new)]
                _log(state, f"Added {n_new} polynomial interaction features")
            except Exception:
                pass

        # Step 4 — Log transform skewed features
        for col in numeric_cols:
            if col in X.columns:
                skewness = X[col].skew()
                if abs(skewness) > 1.5 and X[col].min() >= 0:
                    X[col] = np.log1p(X[col])
                    report["log_transformed"].append(col)
        if report["log_transformed"]:
            _log(state, f"Log-transformed {len(report['log_transformed'])} skewed features")

        # Step 5 — SMOTE for class imbalance
        if problem_type == "classification":
            class_counts    = y.value_counts()
            imbalance_ratio = class_counts.max() / class_counts.min()
            if imbalance_ratio > 3:
                try:
                    from imblearn.over_sampling import SMOTE
                    sm       = SMOTE(random_state=42)
                    X_r, y_r = sm.fit_resample(X, y)
                    X = pd.DataFrame(X_r, columns=X.columns)
                    y = pd.Series(y_r, name=target)
                    report["smote_applied"] = True
                    _log(state, f"SMOTE applied — fixed {imbalance_ratio:.1f}:1 imbalance ✓")
                except ImportError:
                    _log(state, "SMOTE not available — skipping")

        # Step 6 — Feature selection (only if many features)
        if len(X.columns) > 20:
            try:
                k           = min(20, len(X.columns))
                selector_fn = f_classif if problem_type == "classification" \
                              else f_regression
                selector    = SelectKBest(selector_fn, k=k)
                X_sel       = selector.fit_transform(X, y)
                sel_cols    = X.columns[selector.get_support()].tolist()
                X = pd.DataFrame(X_sel, columns=sel_cols)
                report["features_selected"] = k
                report["selected_columns"] = sel_cols
                _log(state, f"Selected top {k} features via F-test ✓")
            except Exception:
                pass

        report["final_feature_count"] = len(X.columns)
        report["final_columns"] = X.columns.tolist()

        df_out          = X.copy()
        df_out[target]  = y.values

        state["engineered_df"]      = df_out
        state["engineering_report"] = report

        _log(state, f"✓ FeatureEngineerAgent complete — {len(X.columns)} features")

    except Exception as e:
        state["error"] = f"FeatureEngineerAgent failed: {str(e)}"
        _log(state, f"✗ FeatureEngineerAgent error: {str(e)}")

    return state


# ═══════════════════════════════════════════════════
# AGENT 3 — MODEL SELECTOR AGENT
# ═══════════════════════════════════════════════════

def model_selector_agent(state: AgentState) -> AgentState:
    if state.get("error"):
        return state

    _log(state, "🤖 ModelSelectorAgent starting...")

    try:
        df           = state["engineered_df"].copy()
        target       = state["target_column"]
        problem_type = state["problem_type"]
        dataset_size = state["dataset_size"]

        X = df.drop(columns=[target])
        y = df[target]

        scaler   = RobustScaler()
        X_scaled = scaler.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y,
            test_size=0.2,
            random_state=42,
            stratify=y if problem_type == "classification" else None
        )

        _log(state, f"Train: {len(X_train)} | Test: {len(X_test)}")

        models  = _get_models(problem_type, dataset_size)
        results = []

        _log(state, f"🧠 Training {len(models)} models...")

        for name, model in models.items():
            try:
                _log(state, f"⟳ Training {name}...")
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)

                if problem_type == "classification":
                    labels = sorted(pd.Series(y_test).dropna().unique().tolist())
                    metrics = {
                        "accuracy":  round(float(accuracy_score(y_test, y_pred)), 4),
                        "f1_score":  round(float(f1_score(y_test, y_pred, average='weighted', zero_division=0)), 4),
                        "precision": round(float(precision_score(y_test, y_pred, average='weighted', zero_division=0)), 4),
                        "recall":    round(float(recall_score(y_test, y_pred, average='weighted', zero_division=0)), 4),
                    }
                    metrics["confusion_matrix"] = confusion_matrix(y_test, y_pred, labels=labels).tolist()
                    target_classes = (state.get("cleaning_report") or {}).get("target_classes") or []
                    metrics["confusion_labels"] = [
                        target_classes[int(label)] if target_classes and int(label) < len(target_classes) else str(label)
                        for label in labels
                    ]
                    primary = metrics["accuracy"]
                else:
                    r2   = r2_score(y_test, y_pred)
                    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
                    mae  = float(mean_absolute_error(y_test, y_pred))
                    metrics = {
                        "r2_score": round(float(r2), 4),
                        "rmse":     round(rmse, 4),
                        "mae":      round(mae, 4),
                    }
                    primary = r2

                results.append({
                    "model_name":    name,
                    "metrics":       metrics,
                    "primary_score": primary,
                    "tuned":         False,
                })
                _log(state, f"  ✓ {name}: {primary:.4f}")

            except Exception as e:
                _log(state, f"  ✗ {name}: skipped ({str(e)})")

        results.sort(key=lambda x: x["primary_score"], reverse=True)
        state["model_results"] = results

        _log(state, f"✓ ModelSelectorAgent complete — best: {results[0]['model_name']} ({results[0]['primary_score']:.4f})")

    except Exception as e:
        state["error"] = f"ModelSelectorAgent failed: {str(e)}"
        _log(state, f"✗ ModelSelectorAgent error: {str(e)}")

    return state


# ═══════════════════════════════════════════════════
# AGENT 4 — TUNER AGENT
# ═══════════════════════════════════════════════════

def tuner_agent(state: AgentState) -> AgentState:
    if state.get("error"):
        return state

    _log(state, "🤖 TunerAgent starting...")

    try:
        df           = state["engineered_df"].copy()
        target       = state["target_column"]
        problem_type = state["problem_type"]
        dataset_size = state["dataset_size"]
        results      = state["model_results"].copy()

        X = df.drop(columns=[target])
        y = df[target]

        scaler   = RobustScaler()
        X_scaled = scaler.fit_transform(X)

        # Smart iteration count — larger dataset = fewer iterations = faster
        n_features = len(X.columns)
        if dataset_size > 5000 or n_features > 15:
            n_iter = 3
        elif dataset_size > 1000:
            n_iter = 8
        else:
            n_iter = 20

        # Fewer models to tune for large datasets
        top_n    = 3 if dataset_size > 5000 else 5
        top_models = [r["model_name"] for r in results[:top_n]]

        cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42) \
             if problem_type == "classification" \
             else KFold(n_splits=3, shuffle=True, random_state=42)

        scoring       = "accuracy" if problem_type == "classification" else "r2"
        tuning_params = _get_tuning_params(problem_type)
        models        = _get_models(problem_type, dataset_size)
        lookup        = {r["model_name"]: r for r in results}

        _log(state, f"🔬 Tuning top {top_n} models ({n_iter} iterations each)...")

        for model_name in top_models:
            if model_name not in tuning_params or model_name not in models:
                _log(state, f"  Skipping {model_name} (no search space)")
                continue

            _log(state, f"⟳ Tuning {model_name}...")

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
                old_score   = lookup[model_name]["primary_score"]
                improvement = best_score - old_score

                if best_score > old_score:
                    lookup[model_name]["primary_score"] = round(float(best_score), 4)
                    lookup[model_name]["tuned"]         = True
                    lookup[model_name]["best_params"]   = search.best_params_
                    _log(state, f"  ✓ {model_name}: {old_score:.4f} → {best_score:.4f} (+{improvement:.4f})")
                else:
                    _log(state, f"  ✓ {model_name}: original params optimal")

            except Exception as e:
                _log(state, f"  ✗ {model_name}: {str(e)}")

        final = list(lookup.values())
        final.sort(key=lambda x: x["primary_score"], reverse=True)
        state["tuned_results"] = final

        best = final[0]
        _log(state, f"✓ TunerAgent complete — 🏆 {best['model_name']}: {best['primary_score']:.4f}")

    except Exception as e:
        state["error"] = f"TunerAgent failed: {str(e)}"
        _log(state, f"✗ TunerAgent error: {str(e)}")

    return state


# ═══════════════════════════════════════════════════
# AGENT 5 — EXPLAINER AGENT
# ═══════════════════════════════════════════════════

def explainer_agent(state: AgentState) -> AgentState:
    if state.get("error"):
        return state

    _log(state, "🤖 ExplainerAgent starting...")

    try:
        import pickle
        import os

        df           = state["engineered_df"].copy()
        target       = state["target_column"]
        problem_type = state["problem_type"]
        results      = state["tuned_results"]
        best         = results[0]

        X = df.drop(columns=[target])
        y = df[target]
        features = X.columns.tolist()

        scaler   = RobustScaler()
        X_scaled = scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y, test_size=0.2, random_state=42
        )

        # ── Train best model on FULL data ─────────────────
        # We retrain using ALL data (not just 80%) for deployment
        # This gives the strongest possible model for production
        best_model_obj = _get_models(problem_type, state["dataset_size"]).get(
            best["model_name"]
        )

        if best_model_obj is not None:
            _log(state, f"Training final {best['model_name']} on full dataset...")
            best_model_obj.fit(X_scaled, y)
            _log(state, "Final model trained on 100% of data ✓")
        else:
            # Fallback to Random Forest
            best_model_obj = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1) \
                             if problem_type == "classification" \
                             else RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)
            best_model_obj.fit(X_scaled, y)

        # ── Save model + scaler + features to disk ─────────
        # We save THREE things together:
        # 1. The trained model (makes predictions)
        # 2. The scaler (transforms new data the same way)
        # 3. Feature names (validates incoming prediction requests)
        model_dir  = "/app/models"
        os.makedirs(model_dir, exist_ok=True)

        import uuid
        model_id   = str(uuid.uuid4())
        model_path = os.path.join(model_dir, f"{model_id}.pkl")

        model_package = {
            "model":        best_model_obj,
            "scaler":       scaler,
            "features":     features,
            "target":       target,
            "problem_type": problem_type,
            "model_name":   best["model_name"],
            "cleaning_report":     state.get("cleaning_report") or {},
            "engineering_report":  state.get("engineering_report") or {},
            "input_features":      (state.get("cleaning_report") or {}).get("raw_feature_columns", features),
        }

        with open(model_path, "wb") as f:
            pickle.dump(model_package, f)

        _log(state, f"Model saved to disk ✓ ({model_id[:8]}...)")

        # ── Feature importance ─────────────────────────────
        rf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1) \
             if problem_type == "classification" \
             else RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
        rf.fit(X_train, y_train)

        importances = rf.feature_importances_
        feature_importance = sorted([
            {"feature": f, "importance": round(float(imp), 4)}
            for f, imp in zip(features, importances)
        ], key=lambda x: x["importance"], reverse=True)

        _log(state, "Feature importance calculated ✓")
        for f in feature_importance[:3]:
            _log(state, f"  → {f['feature']}: {f['importance']:.4f}")

        # ── SHAP global summary ────────────────────────────
        shap_summary = []
        try:
            import shap
            _log(state, "Calculating SHAP values...")
            explainer    = shap.TreeExplainer(rf)
            X_shap       = X_test[:200]
            shap_values  = explainer.shap_values(X_shap)

            if problem_type == "classification" and isinstance(shap_values, list):
                sv = shap_values[1]
            else:
                sv = shap_values

            mean_shap = np.abs(sv).mean(axis=0)
            shap_summary = sorted([
                {
                    "feature":       features[i],
                    "mean_shap":     round(float(mean_shap[i]), 4),
                    "sample_values": [round(float(sv[j][i]), 4) for j in range(min(10, len(sv)))]
                }
                for i in range(len(features))
            ], key=lambda x: abs(x["mean_shap"]), reverse=True)

            _log(state, f"SHAP calculated ✓ ({len(X_shap)} samples)")

        except Exception as e:
            _log(state, f"SHAP skipped: {str(e)}")

        state["feature_importance"] = feature_importance
        state["final_result"] = {
            "problem_type":       problem_type,
            "best_model":         best["model_name"],
            "best_metrics":       best["metrics"],
            "all_models":         results,
            "feature_importance": feature_importance,
            "shap_summary":       shap_summary,
            "dataset_size":       state["dataset_size"],
            "cleaning_report":    state.get("cleaning_report", {}),
            "engineering_report": state.get("engineering_report", {}),
            "model_path":         model_path,     # ← NEW: saved model location
            "features":           features,       # ← NEW: feature names for deployment
        }

        _log(state, "✓ ExplainerAgent complete")
        _log(state, f"🏆 Best: {best['model_name']} — {best['primary_score']:.4f}")
        _log(state, "🎉 All agents finished!")

    except Exception as e:
        state["error"] = f"ExplainerAgent failed: {str(e)}"
        _log(state, f"✗ ExplainerAgent error: {str(e)}")

    return state
