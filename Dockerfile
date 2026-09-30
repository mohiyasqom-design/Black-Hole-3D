FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive
ENV BLENDER_VERSION=4.5.14
ENV BLENDER_DIR=/opt/blender

WORKDIR /app

# System libraries required by Blender
RUN apt-get update && apt-get install -y \
    wget \
    xz-utils \
    ca-certificates \
    libx11-6 \
    libxfixes3 \
    libxi6 \
    libxrender1 \
    libxkbcommon0 \
    libsm6 \
    libxext6 \
    libgl1 \
    libegl1 \
    libfontconfig1 \
    libdbus-1-3 \
    libgomp1 \
    libwayland-client0 \
    libxrandr2 \
    libxcursor1 \
    libnss3 \
    libasound2 \
    libpulse0 \
    libxcomposite1 \
    libxdamage1 \
    && rm -rf /var/lib/apt/lists/*

# Install Blender
RUN wget -q \
    "https://download.blender.org/release/Blender4.5/blender-${BLENDER_VERSION}-linux-x64.tar.xz" \
    -O /tmp/blender.tar.xz \
    && mkdir -p /opt \
    && tar -xJf /tmp/blender.tar.xz -C /opt \
    && mv "/opt/blender-${BLENDER_VERSION}-linux-x64" "${BLENDER_DIR}" \
    && ln -s "${BLENDER_DIR}/blender" /usr/local/bin/blender \
    && rm /tmp/blender.tar.xz

# Verify Blender
RUN blender --version

# Install Node dependencies
COPY package*.json ./
RUN npm ci

# Copy project
COPY . .

# Generate Blender GLB assets
RUN echo "========================================" \
    && echo " BLACK HOLE LABORATORY - BLENDER BUILD" \
    && echo "========================================" \
    && blender -b --python blender/generate_all.py -- --no-bake \
    && echo "========================================" \
    && echo " BLENDER ASSETS GENERATED" \
    && echo "========================================" \
    && ls -lh public/assets/models/

# Build web application
RUN npm run build

# Railway provides PORT
EXPOSE 4173

CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT:-4173}"]
