module.exports = function (grunt) {

    grunt.loadTasks(__dirname + "/../node_modules/grunt-rsync/tasks")
    grunt.loadTasks(__dirname + "/../node_modules/grunt-ssh/tasks")
    grunt.loadTasks(__dirname + "/../node_modules/grunt-template/tasks");

    grunt.registerTask('remotehosting', 'Deploy to remotehosting', function (n) {
        var remotehostingConfig = grunt.option('remotehosting-config');

        /* check if a remotehosting config file has been passed */
        if (remotehostingConfig === undefined) {
            grunt.fail.fatal('you need to specify a --remotehosting-config option')
        } else {
            console.log(remotehostingConfig);
        }

        /* read the settings */
        var jsonConfig = grunt.file.readJSON(remotehostingConfig);

        jsonConfig.environment = jsonConfig.environment || "";
        jsonConfig.maintenanceEnabled = jsonConfig.maintenanceEnabled  || false;
        jsonConfig.chmodDisabled = jsonConfig.chmodDisabled  || false;

        /* read private key */
        var privateKeyFile = jsonConfig.ssh.privateKeyFile;
        var privateKey;
        if (privateKeyFile) {
            privateKey = grunt.file.read(privateKeyFile);
            jsonConfig.ssh.privateKey = privateKey;
        }

        /* read the settings */
        grunt.config.set('remotehosting', jsonConfig);

        // Create our build directory
        grunt.file.mkdir("remotehosting-build");
        grunt.file.mkdir("$CIRCLE_ARTIFACTS/logs");




        var rsyncDefaultExclude = ["node_modules", "storage/*.*","storage/***/*.*", "app/storage/***/*", "app/storage/meta/down",".ssh"];
        var rsyncExclude = jsonConfig.rsync && jsonConfig.rsync.exclude || [];
        rsyncExclude = rsyncExclude.concat(rsyncDefaultExclude);

        var localPath = jsonConfig.localPath || 'project';


        var rsyncArgs = jsonConfig.rsync && jsonConfig.rsync.args || [];
        var remotePort = jsonConfig.ssh && jsonConfig.ssh.port || 22;
        var readyTimeout = jsonConfig.ssh && jsonConfig.ssh.readyTimeout || 40000;
        
        /* prepare the RSYNC options */
        var rsyncOptions = {
            options: {
                recursive: true
            },
            remotehosting_build_local: {
                options: {
                    args: ["-az", "--super", "--log-file=\"$CIRCLE_ARTIFACTS/rsync_local.log\""],
                    src: localPath + "/",
                    exclude: [
                        ".git*",
                        "node_modules"
                        // "config/"  // we need it in production
                    ],
                    dest: "remotehosting-build/www",
                    syncDestIgnoreExcl: true
                }
            },
            remotehosting_remote_rsync: { // Copies build to remote remotehosting but ignores certain files
                options: {
                    args: ["-z", "--super", "--log-file=\"$CIRCLE_ARTIFACTS/rsync_remote.log\""].concat(rsyncArgs),
                    ssh: true,
                    compareMode: 'checksum', // On remotehosting times don't get synched, so we use checksum
                    src: "remotehosting-build/www/",
                    syncDestIgnoreExcl: true, // Delete files on remote that don't exist local
                    exclude: rsyncExclude, // But don't remove these directories
                    dest: "<%= remotehosting.remotePath %><%= remotehosting.deployFolder %>",
                    host: "<%= remotehosting.ssh.username + '@' + remotehosting.ssh.hostname %>",
                    port: remotePort
                }
            }
        }

        grunt.config.set('rsync', rsyncOptions);

        //grunt.config.set('template',templateOptions);
        
        var sshConnectionOptions = {
            host: '<%= remotehosting.ssh.hostname %>',
            username: '<%= remotehosting.ssh.username %>',
            password: '<%= remotehosting.ssh.password %>',
            privateKey: '<%= remotehosting.ssh.privateKey %>',
            port: remotePort,
            readyTimeout: readyTimeout
        };
        
        
        var customCommandsPre = [],
            customCommandsPost = [];
            
        if (jsonConfig.customCommands) {
            if(jsonConfig.customCommands.pre) {
                customCommandsPre = [].concat(jsonConfig.customCommands.pre);
            }   
            if(jsonConfig.customCommands.post) {
                customCommandsPost = [].concat(jsonConfig.customCommands.post);
            }   
        }

        /* prepare the SSH Exec options */
        sshexecOptions = {
            run_prepare_remotehosting_sh: {
                command: 'chmod +x <%= remotehosting.remotePath %>/prepare_remotehosting.sh && cd <%= remotehosting.remotePath %> && ./prepare_remotehosting.sh <%= remotehosting.environment %> ',
                options: sshConnectionOptions
            },
            remove_prepare_remotehosting_sh: {
                command: 'rm ' + '<%= remotehosting.remotePath %>/' + './prepare_remotehosting.sh',
                options: sshConnectionOptions
            },
            run_artisan_up: {
                command: 'cd <%= remotehosting.remotePath %> && php artisan up',
                options: sshConnectionOptions
            },
            run_artisan_down: {
                command: 'cd <%= remotehosting.remotePath %> && php artisan down',
                options: sshConnectionOptions
            },
            run_custom_commands_pre: {
                command: customCommandsPre.map(function(x){return 'cd <%= remotehosting.remotePath %> && ' + x;}),
                options: sshConnectionOptions
            },
            run_custom_commands_post: {
                command: customCommandsPost.map(function(x){return 'cd <%= remotehosting.remotePath %> && ' + x;}),
                options: sshConnectionOptions
            }
        }

        grunt.config.set('sshexec', sshexecOptions);
        
        
        var sftpConfig = jsonConfig.sftp || {};

        /* prepare the SfTP Exec options */
        sftpOptions = {
            prepare_remotehosting_sh: {
                files: {
                    "./": "deploy/prepare_remotehosting.sh"
                },
                options: {
                    srcBasePath: 'deploy',
                    path: typeof sftpConfig.path !== 'undefined' ? sftpConfig.path : '<%= remotehosting.remotePath %>',
                    host: '<%= remotehosting.ssh.hostname %>',
                    username: '<%= remotehosting.ssh.username %>',
                    password: '<%= remotehosting.ssh.password %>',
                    privateKey: '<%= remotehosting.ssh.privateKey %>',
                    port: remotePort,
                    showProgress: true,
                    readyTimeout: readyTimeout
                },
            },
        };

        grunt.config.set('sftp', sftpOptions);

        /* Task sequence to run */
        grunt.task.run('rsync:remotehosting_build_local');

        if (jsonConfig.maintenanceEnabled) {
            grunt.task.run('sshexec:run_artisan_down');
        }
        
        if (customCommandsPre.length) {
            grunt.task.run('sshexec:run_custom_commands_pre');
        }

        grunt.task.run('rsync:remotehosting_remote_rsync');
        
        
        
        if (!jsonConfig.chmodDisabled) {
            grunt.task.run('sftp:prepare_remotehosting_sh');
            grunt.task.run('sshexec:run_prepare_remotehosting_sh');
            grunt.task.run('sshexec:remove_prepare_remotehosting_sh');
        }
        
        
        
        if (customCommandsPost.length) {
            grunt.task.run('sshexec:run_custom_commands_post');
        }

        if (jsonConfig.maintenanceEnabled) {
            grunt.task.run('sshexec:run_artisan_up');
        }

    });

}
