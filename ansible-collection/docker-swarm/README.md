# Poulay Ansible collection Docker Swarm

[[_TOC_]]

## Install the collection

### Add the collection to your project

Add the collection in your Ansible project `requirements.yml` file

```shell
  - name: git@github.com:PoulayCurriz/swarm-homelab.git
    type: git
    version: 1.2.0
```

### Run the installation

```shell
ansible-galaxy install -r requirements.yml
```

## Supported systems

| Distribution  | Versions | Architectures            |
| ------------- | -------- | ------------------------ |
| Rocky Linux   | 9        | x86_64, aarch64          |
| Debian        | 12, 13   | x86_64 (amd64), aarch64 (arm64) |

On Debian, AppArmor replaces SELinux (`poulay_docker_swarm_daemon_selinux_*` variables are ignored), ufw replaces firewalld, and the Python libraries (Docker SDK, jsondiff, PyYAML) are installed from Debian packages (`python3-docker`, `python3-jsondiff`, `python3-yaml`) into the system Python, so no `ansible_python_interpreter` is needed. `poulay_docker_swarm_pypi_registry` is not used on Debian.

## Configure your inventory

This collection will search for two group in your inventory.

- manager
- worker

Make sure this group is present; otherwise, your playbook will fail. The role you give to each host is important; firewall rules are applied based on that.

## Use the collection in your playbook

```yaml
- name: Create Docker Swarm cluster
  hosts: 'all'
  tasks:
    - name: Import requirements role from poulay.docker_swarm collection
      ansible.builtin.import_role:
        name: poulay.docker_swarm.requirements
    - name: Import init_cluster role from poulay.docker_swarm collection
      ansible.builtin.import_role:
        name: poulay.docker_swarm.init_cluster
```

## Variables

Add this variables to your `group_vars` or `host_vars` to configure your installation

| Name                                      | Default value                                                     | Description |
| ----------------------------------------- | ----------------------------------------------------------------- | ----------- |
| poulay_docker_swarm_repository_url           |                                                  | Global repository. Set `download.docker.com` to use public repositories, see [Public repositories](#public-repositories) |
| poulay_docker_swarm_repository_path          |                                                         | Global repository path. For Nexus it's `repository` and for Artifactory it's `artifactory` |
| poulay_docker_swarm_rpm_registry             | | RPM registry for Docker Engine |
| poulay_docker_swarm_apt_registry             | | APT registry for Docker Engine on Debian (proxy of `download.docker.com/linux/debian`). Set `download.docker.com/linux` to use Docker repository directly |
| poulay_docker_swarm_image_registry           |                   | Docker images registry mirror. Empty: no mirror, images are pulled from Docker Hub |
| poulay_docker_swarm_pypi_registry            |     | PyPi registry |
| poulay_docker_swarm_centos_rpm_registry      |   | RPM registry for CentOS 7 installation |
| poulay_docker_swarm_engine_version           | 29.9.3                                                            | Docker Engine version |
| poulay_docker_swarm_allow_downgrade          | false                                                             | By default the role fails if installed Docker packages are newer than the requested versions. Set `true` to downgrade them (restarts all containers on the node) |
| poulay_docker_swarm_compose_version          | 5.7.0                                                             | Docker Compose version |
| poulay_docker_swarm_containerd_version       | 2.4.2                                                             | containerd.io version |
| poulay_docker_swarm_buildx_version           | 0.39.0                                                            | Docker buildx version |
| poulay_docker_swarm_daemon_pool_address      | 172.22.0.0/17                                                     | Docker Daemon default address pool |
| poulay_docker_swarm_cluster_pool_address     | 172.22.128.0/17                                                   | Docker Swarm default address pool |
| poulay_docker_swarm_daemon_selinux_enabled   | true                                                              | Control SELinux activation |
| poulay_docker_swarm_selinux_container_paths  | []                                                                | Host folders bind-mounted in containers, labeled `container_file_t` |
| poulay_docker_swarm_selinux_reboot           | true                                                              | Reboot the node when SELinux was disabled (one node at a time). If `false`, the role fails and asks for a manual reboot |
| poulay_docker_swarm_selinux_reboot_timeout   | 3600                                                              | Reboot timeout in seconds, the first boot with SELinux relabels the whole filesystem |
| poulay_docker_swarm_apparmor_enabled         | true                                                              | Debian only: install and start AppArmor, Docker then applies its `docker-default` profile to containers |
| poulay_docker_swarm_ufw_enabled              | true                                                              | Debian only: install and enable ufw with Swarm rules |
| poulay_docker_swarm_ufw_ssh_port             | {{ ansible_port \| default(22) }}                                  | Debian only: SSH port allowed before enabling ufw |
| poulay_docker_swarm_ufw_extra_rules          | []                                                                | Debian only: extra ufw rules (`port`, `proto`, `from_ip`, `rule`, `comment`) for other services of the host |
| poulay_docker_swarm_advertise_addr           | {{ ansible_facts['default_ipv4']['address'] }}                    | IP address (or interface) advertised to the Swarm, also used for firewall rules between nodes |
| poulay_docker_swarm_node_cert_expiry_days    | 365                                                              | Swarm node certificates lifetime in days (Docker default: 90). Only applies to certificates issued after the change: next automatic renewal, or `docker swarm ca --rotate` |

## Public repositories

Hosts without access to Nexus/Artifactory can install everything from public repositories:

```yaml
poulay_docker_swarm_repository_url: download.docker.com
```

The registry defaults then become:

| Variable                            | Value                       |
| ----------------------------------- | --------------------------- |
| poulay_docker_swarm_rpm_registry       | download.docker.com/linux   |
| poulay_docker_swarm_apt_registry       | download.docker.com/linux   |
| poulay_docker_swarm_image_registry     | empty (no Docker Hub mirror)|
| poulay_docker_swarm_pypi_registry      | pypi.org                    |

CentOS 7 is not supported in this mode.

## SELinux

When `poulay_docker_swarm_daemon_selinux_enabled` is `true`, the role sets SELinux to `enforcing` and installs the `docker_socket_container` module. This module allows containers to use the Docker socket (Traefik, Portainer...).

> **Warning:** Swarm services cannot set a per-service SELinux label, so this rule applies to all containers. A container mounting `/var/run/docker.sock` has root access on the node: only mount it in trusted services.

Containers cannot read host folders that are not labeled for them. List bind-mounted folders in `poulay_docker_swarm_selinux_container_paths` to label them `container_file_t`:

```yaml
poulay_docker_swarm_selinux_container_paths:
  - /data/traefik
  - /opt/app/config
```

### Upgrade from a version allowing `default_t`

Previous versions of the `docker_socket_container` module allowed all containers to read files labeled `default_t`. This rule is removed: before upgrading an existing cluster, add the bind-mounted folders to `poulay_docker_swarm_selinux_container_paths`.

On each node, list the bind-mounted folders of running containers with their SELinux label. Folders labeled `default_t` must be added:

```shell
docker ps -q | xargs docker inspect --format '{{range .Mounts}}{{if eq .Type "bind"}}{{.Source}}{{"\n"}}{{end}}{{end}}' | sort -u | xargs ls -Zd
```

After the upgrade, check SELinux denials on `default_t` files:

```shell
ausearch -m avc -ts today | grep default_t
```

## AppArmor (Debian)

When `poulay_docker_swarm_apparmor_enabled` is `true`, the role installs AppArmor tools and starts the `apparmor` service, then restarts Docker so it loads the `docker-default` profile. Unlike SELinux, bind-mounted folders and the Docker socket need no labeling. The role fails if AppArmor is disabled in the kernel (`apparmor=0` on the kernel command line).

Check the profile applied to a container:

```shell
docker inspect --format '{{ .AppArmorProfile }}' <container>
```

## ufw (Debian)

When `poulay_docker_swarm_ufw_enabled` is `true`, the role installs ufw, denies incoming traffic by default and allows:

- SSH (`poulay_docker_swarm_ufw_ssh_port`), added before ufw is enabled
- `2377/tcp` on managers, `7946/tcp` and `7946/udp` on all nodes
- `9789/udp` (VXLAN) and ESP from Swarm nodes only
- `poulay_docker_swarm_ufw_extra_rules`

> **Warning:** every other incoming port of the host is closed. Add the services running outside Docker (monitoring agent, etc.) to `poulay_docker_swarm_ufw_extra_rules`:

```yaml
poulay_docker_swarm_ufw_extra_rules:
  - { port: "9100", proto: tcp, from_ip: 10.0.0.0/8, comment: node_exporter }
```

Ports published by Swarm services go through Docker's own iptables rules and are **not** filtered by ufw: they are reachable without ufw rules.

## Upgrade Docker

Changing `poulay_docker_swarm_engine_version` upgrades Docker in place: the Swarm cluster is kept. Docker installation and restart run on one node at a time (`throttle: 1`), so the cluster stays available during the upgrade. Use the same playbook as for the installation.
