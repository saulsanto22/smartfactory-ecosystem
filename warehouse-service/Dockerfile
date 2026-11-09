FROM golang:1.23-alpine AS builder

WORKDIR /app

ENV GOPROXY=https://goproxy.io,direct
ENV GOTOOLCHAIN=auto

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o warehouse-app main.go

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/warehouse-app .
RUN mkdir -p /app/uploads

EXPOSE 8081

CMD ["./warehouse-app"]
