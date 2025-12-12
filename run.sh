#!/bin/bash
# =====================================================
# Nazra - Unified Run Script
# =====================================================

cd "$(dirname "$0")"
PROJECT_DIR=$(pwd)

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# ==========================================
# Stop ports function
# ==========================================
stop_ports() {
    echo -e "${YELLOW}Stopping services...${NC}"
    
    for PORT in 3000 5173 8000; do
        PIDS=$(lsof -t -i :$PORT 2>/dev/null)
        if [ -n "$PIDS" ]; then
            kill -9 $PIDS 2>/dev/null
            echo -e "   ${GREEN}✓${NC} Port $PORT released"
        fi
    done
    echo ""
}

# ==========================================
# Setup environment
# ==========================================
setup_environment() {
    # Environment variables
    export YOLO_DEVICE="auto"
    export YOLO_MODEL_PATH="$PROJECT_DIR/backend/models/best.pt"
    export DATABASE_URL="sqlite+aiosqlite:///$PROJECT_DIR/data/nazra.db"
    
    # Create directories
    mkdir -p data alerts snapshots uploads logs
    
    # Check Redis (optional)
    if command -v redis-cli &> /dev/null && redis-cli ping &> /dev/null 2>&1; then
        export REDIS_ENABLED="true"
        export REDIS_URL="redis://localhost:6379/0"
        echo -e "   ${GREEN}✓${NC} Redis connected"
    else
        export REDIS_ENABLED="false"
        echo -e "   ${YELLOW}!${NC} Redis not available (optional)"
    fi
}

# ==========================================
# Show system info
# ==========================================
show_system_info() {
    echo -e "${BLUE}System Info:${NC}"
    python3 -c "
import torch
print(f'   PyTorch: {torch.__version__}')
if hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
    print('   MPS (Metal): Available')
elif torch.cuda.is_available():
    print('   CUDA: Available')
else:
    print('   CPU: Will use processor')
" 2>/dev/null || echo "   Could not read PyTorch info"
    echo ""
}

# ==========================================
# Run Backend only
# ==========================================
run_backend() {
    echo -e "${CYAN}Starting Backend...${NC}"
    echo ""
    echo -e "   ${BLUE}Backend:${NC}  http://localhost:8000"
    echo -e "   ${BLUE}API Docs:${NC} http://localhost:8000/docs"
    echo ""
    echo -e "${YELLOW}   Press Ctrl+C to stop${NC}"
    echo "======================================"
    echo ""
    
    cd "$PROJECT_DIR/backend"
    python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
}

# ==========================================
# Run Frontend only
# ==========================================
run_frontend() {
    echo -e "${CYAN}Starting Frontend...${NC}"
    echo ""
    echo -e "   ${BLUE}Frontend:${NC} http://localhost:5173"
    echo ""
    echo -e "${YELLOW}   Press Ctrl+C to stop${NC}"
    echo "======================================"
    echo ""
    
    cd "$PROJECT_DIR/frontend"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "   Installing node_modules..."
        npm install
    fi
    
    npm run dev
}

# ==========================================
# Run All (Backend + Frontend)
# ==========================================
run_all() {
    echo -e "${CYAN}Starting Backend + Frontend...${NC}"
    echo ""
    echo -e "   ${BLUE}Backend:${NC}  http://localhost:8000"
    echo -e "   ${BLUE}API Docs:${NC} http://localhost:8000/docs"
    echo -e "   ${BLUE}Frontend:${NC} http://localhost:5173"
    echo ""
    echo -e "${YELLOW}   Press Ctrl+C to stop${NC}"
    echo "======================================"
    echo ""
    
    # Start Backend in background
    cd "$PROJECT_DIR/backend"
    python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    
    sleep 2
    
    # Start Frontend
    cd "$PROJECT_DIR/frontend"
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    npm run dev &
    FRONTEND_PID=$!
    
    # Cleanup on exit
    cleanup() {
        echo ""
        echo -e "${YELLOW}Stopping services...${NC}"
        kill $BACKEND_PID 2>/dev/null
        kill $FRONTEND_PID 2>/dev/null
        echo -e "${GREEN}✓ All services stopped${NC}"
        exit 0
    }
    
    trap cleanup SIGINT SIGTERM
    wait
}

# ==========================================
# Show help
# ==========================================
show_help() {
    echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         Nazra - Run Script               ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Usage:${NC}"
    echo "  ./run.sh [command]"
    echo ""
    echo -e "${BLUE}Commands:${NC}"
    echo -e "  ${GREEN}(no command)${NC}  Start Backend + Frontend"
    echo -e "  ${GREEN}all${NC}           Start Backend + Frontend"
    echo -e "  ${GREEN}backend${NC}       Start Backend only"
    echo -e "  ${GREEN}frontend${NC}      Start Frontend only"
    echo -e "  ${GREEN}stop${NC}          Stop all services"
    echo -e "  ${GREEN}help${NC}          Show this help"
    echo ""
    echo -e "${BLUE}Examples:${NC}"
    echo "  ./run.sh              # Start all"
    echo "  ./run.sh backend      # Backend only"
    echo "  ./run.sh stop         # Stop all"
    echo ""
}

# ==========================================
# Main
# ==========================================

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Nazra System                     ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

case "${1:-all}" in
    stop)
        stop_ports
        echo -e "${GREEN}✓ All services stopped${NC}"
        ;;
    backend|b)
        stop_ports
        setup_environment
        show_system_info
        run_backend
        ;;
    frontend|f)
        stop_ports
        run_frontend
        ;;
    all|"")
        stop_ports
        setup_environment
        show_system_info
        run_all
        ;;
    help|-h|--help)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac


