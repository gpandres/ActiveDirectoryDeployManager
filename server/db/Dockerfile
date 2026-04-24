FROM mariadb:11.4

# Bake the init SQL and performance config into the image. Avoids
# bind-mount permission issues on Docker Desktop for Windows when
# the project lives under OneDrive / paths with Windows-specific
# ACLs that don't translate to the mysql UID inside the container.

COPY --chown=mysql:mysql --chmod=0444 init/*.sql /docker-entrypoint-initdb.d/
COPY --chown=mysql:mysql --chmod=0444 my.cnf    /etc/mysql/conf.d/perf.cnf
