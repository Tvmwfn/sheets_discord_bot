FROM python:3.11
RUN pip install --upgrade pip \
    pip install google-api-python-client \
    pip install google-auth google-auth-oauthlib google-auth-httplib2 \
    pip install --upgrade google-auth \
    pip install -U table2ascii \
    pip install -U pillow \
    pip install -U asyncio \
    pip install -U requests \
    pip install -U discord 
WORKDIR /app
COPY discord_bot.py /app
WORKDIR /data
CMD ["python", "/app/discord_bot.py"]
