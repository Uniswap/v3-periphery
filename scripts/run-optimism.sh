#!/bin/bash

# build in 2 steps
function build_images() {
  docker-compose build --parallel -- builder l2geth l1_chain
  docker-compose build --parallel -- deployer dtl batch_submitter relayer
}

current_dir=$(dirname "$0")

# switch to branch that supports CALLVALUE and SELFBALANCE opcodes: https://github.com/ben-chain/optimism/pull/8
git clone https://github.com/ben-chain/optimism.git
cd optimism/ops
git checkout feat/OP759/call-with-value 

# enabling the Docker BuildKit is recommended
export COMPOSE_DOCKER_CLI_BUILD=1
export DOCKER_BUILDKIT=1

build_images
docker-compose up -d
../../${current_dir}/wait-for-sequencer.sh
