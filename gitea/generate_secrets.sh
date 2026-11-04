#! /bin/sh

print_random () {
  LC_ALL=C tr -dc 'A-Za-z0-9!#%&()*+,-./:;<=>?@[\]^_{|}~' </dev/urandom | head -c 32
}

print_random | docker secret create gitea_database_password -
