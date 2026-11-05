#!/bin/zsh
emulate -L zsh
set -o pipefail

if [[ ! -t 0 ]]; then
  print -u2 'Run this script in an interactive terminal.'
  exit 1
fi

make_hash() {
  local password repeated
  read -r -s 'password?New ATC password: ' || return 1
  print
  read -r -s 'repeated?Repeat password: ' || return 1
  print
  if [[ -z "$password" || "$password" != "$repeated" ]]; then
    print -u2 'Passwords are empty or do not match.'
    return 1
  fi
  print -rn -- "$password" | node -e 'const bcrypt=require("bcryptjs");let password="";process.stdin.on("data",chunk=>password+=chunk);process.stdin.on("end",()=>{if(Buffer.byteLength(password)>72){console.error("Use a password of at most 72 UTF-8 bytes.");process.exitCode=1;return}const hash=bcrypt.hashSync(password,12);if(!bcrypt.compareSync(password,hash)){console.error("Hash verification failed.");process.exitCode=1;return}console.log(hash)})'
}

make_hash
