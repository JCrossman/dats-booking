#!/bin/bash
# Non-destructive agent runner script
# Respects AGENT_NAME and DRY_RUN environment variables

set -e

# Configuration
AGENTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="${AGENTS_DIR}/schema/agent-schema.json"

# Default values
DRY_RUN="${DRY_RUN:-true}"
AGENT_NAME="${AGENT_NAME:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Usage information
usage() {
    cat << EOF
Usage: run-agent.sh [OPTIONS]

Non-destructive agent runner for DATS multi-agent framework.

Environment Variables:
  AGENT_NAME    Name of the agent to run (required)
  DRY_RUN       Run in dry-run mode (default: true)

Options:
  -h, --help    Show this help message

Examples:
  AGENT_NAME=product-manager ./run-agent.sh
  AGENT_NAME=security-privacy DRY_RUN=false ./run-agent.sh

Available Agents:
EOF
    for agent_file in "${AGENTS_DIR}"/*.yml; do
        if [ -f "$agent_file" ]; then
            basename "$agent_file" .yml | sed 's/^/  - /'
        fi
    done
}

# Validate agent name
validate_agent() {
    # Input validation: only allow lowercase letters and hyphens
    if [[ ! "$AGENT_NAME" =~ ^[a-z]+(-[a-z]+)*$ ]]; then
        log_error "Invalid agent name: ${AGENT_NAME}"
        log_error "Agent names must contain only lowercase letters and hyphens"
        return 1
    fi
    
    # Prevent path traversal
    if [[ "$AGENT_NAME" =~ \.\. ]] || [[ "$AGENT_NAME" =~ / ]]; then
        log_error "Invalid agent name: ${AGENT_NAME}"
        log_error "Agent names cannot contain '..' or '/' characters"
        return 1
    fi
    
    local agent_file="${AGENTS_DIR}/${AGENT_NAME}.yml"
    
    if [ ! -f "$agent_file" ]; then
        log_error "Agent configuration not found: ${agent_file}"
        log_info "Available agents:"
        for f in "${AGENTS_DIR}"/*.yml; do
            if [ -f "$f" ]; then
                basename "$f" .yml | sed 's/^/  - /'
            fi
        done
        return 1
    fi
    
    return 0
}

# Parse agent configuration
parse_agent_config() {
    local agent_file="${AGENTS_DIR}/${AGENT_NAME}.yml"
    
    log_info "Parsing agent configuration: ${agent_file}"
    
    # Extract basic metadata (using grep/sed since we don't want to require yq)
    DISPLAY_NAME=$(grep "display_name:" "$agent_file" | sed 's/.*display_name:[[:space:]]*//' | tr -d '"')
    SLASH_COMMAND=$(grep "slash_command:" "$agent_file" | sed 's/.*slash_command:[[:space:]]*//' | tr -d '"')
    DESCRIPTION=$(grep "description:" "$agent_file" | head -1 | sed 's/.*description:[[:space:]]*//' | tr -d '"')
    
    log_success "Agent: ${DISPLAY_NAME}"
    log_info "Command: ${SLASH_COMMAND}"
    log_info "Description: ${DESCRIPTION}"
}

# Simulate agent execution
simulate_agent() {
    log_info "=== Agent Execution Simulation ==="
    log_info "Agent: ${DISPLAY_NAME}"
    log_info "Mode: $([ "$DRY_RUN" = "true" ] && echo "DRY RUN" || echo "LIVE")"
    echo ""
    
    log_info "This agent would perform the following actions:"
    echo "  1. Load agent configuration from ${AGENTS_DIR}/${AGENT_NAME}.yml"
    echo "  2. Initialize agent with project context"
    echo "  3. Execute agent responsibilities:"
    
    # Show agent responsibilities
    local in_responsibilities=false
    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]*responsibilities: ]]; then
            in_responsibilities=true
            continue
        fi
        if [[ "$line" =~ ^[[:space:]]*- && "$in_responsibilities" = true ]]; then
            echo "     $(echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*//')"
        elif [[ ! "$line" =~ ^[[:space:]]*- && "$in_responsibilities" = true ]]; then
            break
        fi
    done < "${AGENTS_DIR}/${AGENT_NAME}.yml"
    
    echo "  4. Apply review criteria and generate output"
    echo "  5. Return results to caller"
    echo ""
    
    if [ "$DRY_RUN" = "true" ]; then
        log_warning "DRY RUN MODE: No actual changes will be made"
    else
        log_warning "LIVE MODE: Agent would make real changes (not implemented yet)"
    fi
}

# Main execution
main() {
    # Check for help flag
    if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        usage
        exit 0
    fi
    
    # Validate AGENT_NAME is provided
    if [ -z "$AGENT_NAME" ]; then
        log_error "AGENT_NAME environment variable is required"
        echo ""
        usage
        exit 1
    fi
    
    log_info "=== DATS Agent Runner ==="
    log_info "Starting agent: ${AGENT_NAME}"
    log_info "Dry run mode: ${DRY_RUN}"
    echo ""
    
    # Validate agent exists
    if ! validate_agent; then
        exit 1
    fi
    
    # Parse agent configuration
    parse_agent_config
    echo ""
    
    # Simulate agent execution
    simulate_agent
    echo ""
    
    log_success "Agent execution simulation completed successfully"
}

# Run main function
main "$@"
