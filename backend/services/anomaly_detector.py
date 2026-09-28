import numpy as np
from sklearn.ensemble import IsolationForest


def detect_anomaly(content_result, metadata_result):
    """
    TrustSphere Layer 6:
    Detect unusual characteristics in a digital asset.
    """

    # Get content features
    text_length = content_result.get(
        "text_length",
        0
    )

    file_size = content_result.get(
        "file_size",
        0
    )

    page_count = content_result.get(
        "page_count",
        1
    )

    # Get metadata features
    metadata_count = metadata_result.get(
        "metadata_count",
        0
    )

    # Create feature vector
    features = np.array([
        text_length,
        metadata_count,
        file_size,
        page_count
    ]).reshape(1, -1)

    features = np.nan_to_num(
        features,
        nan=0,
        posinf=0,
        neginf=0
    )

    try:

        # Prototype baseline dataset
        baseline = np.array([
            [1000, 5, 100000, 2],
            [2000, 6, 200000, 3],
            [3000, 7, 300000, 4],
            [4000, 8, 400000, 5],
            [5000, 9, 500000, 6]
        ])

        # Isolation Forest model
        model = IsolationForest(
            contamination=0.2,
            random_state=42
        )

        model.fit(baseline)

        # Predict anomaly
        prediction = model.predict(features)

        # Get model decision score
        decision_score = model.decision_function(
            features
        )[0]

        # Determine result
        if prediction[0] == -1:

            anomaly_score = 45
            status = "anomaly_detected"

        else:

            anomaly_score = 85
            status = "normal"

        return {

            "score": anomaly_score,

            "status": status,

            "decision_score": float(
                decision_score
            ),

            "features": {

                "text_length": int(
                    text_length
                ),

                "metadata_count": int(
                    metadata_count
                ),

                "file_size": int(
                    file_size
                ),

                "page_count": int(
                    page_count
                )

            }

        }

    except Exception as error:

        return {

            "score": 50,

            "status": "analysis_failed",

            "error": str(error)

        }