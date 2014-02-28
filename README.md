# Description
this task will take a json file that specifies a remotehosting site and will rsync/ftp the necessary php site

# Running the tasks 
`grunt remotehosting --remotehosting-config <config.json>`

# Detail
- it will create a directory remotehosting-build
- copy the directory project to it
- rsync the local directory to the remote site
- sftp the script in deploy/prepare_remotehosting.sh 
- run the script
- and remove it after deploy
