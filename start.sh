#!/usr/bin/env bash

gunicorn --bind 0.0.0.0:$PORT ocr_server:app
