#!/usr/bin/env bash
# DATS Booking Agent Runner Script
# This is a lightweight, non-destructive runner that simulates agent execution.
# All agents default to dry_run=true for safety.

set -e

# Configuration
AGENT_NAME="${AGENT_NAME:-unknown}"
DRY_RUN="${DRY_RUN:-true}"
GITHUB_EVENT_NAME="${GITHUB_EVENT_NAME:-unknown}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-unknown}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Main execution
main() {
    log_info "=========================================="
    log_info "DATS Booking Agent Runner"
    log_info "=========================================="
    log_info "Agent: ${AGENT_NAME}"
    log_info "Repository: ${GITHUB_REPOSITORY}"
    log_info "Event: ${GITHUB_EVENT_NAME}"
    log_info "Dry Run: ${DRY_RUN}"
    log_info "=========================================="

    # Check if agent config exists
    AGENT_CONFIG=".github/agents/${AGENT_NAME}.yml"
    if [[ ! -f "${AGENT_CONFIG}" ]]; then
        log_error "Agent configuration not found: ${AGENT_CONFIG}"
        exit 1
    fi

    log_success "Agent configuration found: ${AGENT_CONFIG}"

    # In dry-run mode (default), we only simulate what the agent would do
    if [[ "${DRY_RUN}" == "true" ]]; then
        log_warning "Running in DRY-RUN mode (safe, non-destructive)"
        log_info ""
        log_info "The agent would perform the following actions:"
        log_info "  1. Read agent configuration from ${AGENT_CONFIG}"
        log_info "  2. Validate permissions and secrets"
        log_info "  3. Execute agent logic based on event: ${GITHUB_EVENT_NAME}"
        log_info "  4. Post results to GitHub (issue comment, PR review, etc.)"
        log_info ""
        log_warning "No actual actions will be taken in DRY-RUN mode"
        log_success "Dry-run simulation completed successfully"
    else
        log_warning "Running in PRODUCTION mode"
        log_error "Production execution not yet implemented"
        log_info "To implement production logic:"
        log_info "  1. Add agent-specific execution logic"
        log_info "  2. Integrate with GitHub API for posting results"
        log_info "  3. Add proper error handling and logging"
        log_info "  4. Test thoroughly before enabling"
        exit 1
    fi

    log_info "=========================================="
    log_success "Agent runner completed"
    log_info "=========================================="
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --simulate|--dry-run)
            DRY_RUN=true
            shift
            ;;
        --agent)
            AGENT_NAME="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --simulate, --dry-run    Run in simulation mode (default)"
            echo "  --agent NAME             Specify agent name"
            echo "  --help                   Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  AGENT_NAME               Agent to execute"
            echo "  DRY_RUN                  Set to 'true' for dry-run mode (default: true)"
            echo "  GITHUB_EVENT_NAME        GitHub event that triggered the workflow"
            echo "  GITHUB_REPOSITORY        GitHub repository"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Execute main function
main
