FROM python:3.12-slim
WORKDIR /opt/pc-pet
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt 'gunicorn>=23,<24'
COPY app app
COPY backend backend
COPY public public
COPY dist dist
COPY deploy/snowflake/app_entry.py app_entry.py
ENV PC_PET_INSTANCE_PATH=/data
EXPOSE 8080
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "4", "--timeout", "40", "app_entry:app"]
