# Description
This grunt automates the copying of files to a remotehosting and will execute a script on the remote ssh server

# Usage
# Loading the tasks in your project Gruntfile
`grunt.loadNpmTasks('grunt-remotehosting');`

## Check if the task is available
`grunt --help`

## Running the tasks 
`grunt remotehosting --remotehosting-config <config.json>`

# Detail
(see tasks/remotehosting.js for steps)

- it will create a directory remotehosting-build
- copy the project to it
- rsync the local directory to the remote site
- sftp the script in deploy/prepare_remotehosting.sh 
- run the script
- and remove it after deploy

# Configfile

```json
{
  "remotePath": "<remote directory location of yourd files>",
  "deployFolder": "<remote deploy folder of your files - can be empty>",
  "ssh": {
    "username": "<your ssh user>",
    "password": "<your ssh password>",
    "hostname": "<your ssh/sftp host>"
  },
  "mysql": {
    "username": "<your mysql user>",
    "password": "<your mysql password>",
    "hostname": "<your mysql host>"
  },
  "rsync": {
    "exclude": ["<Array of files and folders you want to exclude from the rsync. (so they don't get deleted on remote)>"]  
  }
}
```

[Rsync exclude patterns](http://www.samba.org/ftp/rsync/rsync.html) (search for `INCLUDE/EXCLUDE PATTERN RULES`)
  
In a typical Laravel project you start within the "project" folder, so don't include it in your relative path.

# (current)Assumptions
- the local files are located in `project` directory
- the remote script is located in `deploy/prepare_remotehosting.sh`
- it can ssh & sftp using the same credentials
- the remote hosting directory is defined through remotePath + deployFolder
