from flask import Flask, jsonify
from flask_cors import CORS

from models import init_db
from routes import api_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    init_db()
    app.register_blueprint(api_bp)

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "SEWCMS backend"})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
