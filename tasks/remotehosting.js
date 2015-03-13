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




        var rsyncDefaultExclude = ["cache/","app/storage/meta/down"];
        var rsyncExclude = jsonConfig.rsync && jsonConfig.rsync.exclude || [];
        rsyncExclude = rsyncExclude.concat(rsyncDefaultExclude);


        /* prepare the RSYNC options */
        rsyncOptions = {
            options: {
                recursive: true
            },
            remotehosting_build_local: {
                options: {
                    args: ["-avz", "--super"],
                    src: "project/",
                    exclude: [
                        ".git*",
                        // "config/"  // we need it in production
                    ],
                    dest: "remotehosting-build/www",
                    syncDestIgnoreExcl: true
                }
            },
            remotehosting_remote_rsync: { // Copies build to remote remotehosting but ignores certain files
                options: {
                    args: ["-vz", "--super"],
                    ssh: true,
                    compareMode: 'checksum', // On remotehosting times don't get synched, so we use checksum
                    src: "remotehosting-build/www/",
                    syncDestIgnoreExcl: true, // Delete files on remote that don't exist local
                    exclude: rsyncExclude, // But don't remove these directories
                    dest: "<%= remotehosting.remotePath %><%= remotehosting.deployFolder %>",
                    host: "<%= remotehosting.ssh.username + '@' + remotehosting.ssh.hostname %>",
                }
            }
        }

        grunt.config.set('rsync', rsyncOptions);

        //grunt.config.set('template',templateOptions);

        var sshConnectionOptions = {
            host: '<%= remotehosting.ssh.hostname %>',
            username: '<%= remotehosting.ssh.username %>',
            password: '<%= remotehosting.ssh.password %>',
            privateKey: '<%= remotehosting.ssh.privateKey %>'
        };

        /* prepare the SSH Exec options */
        sshexecOptions = {
            run_prepare_remotehosting_sh: {
                command: 'chmod +x <%= remotehosting.remotePath %>/prepare_remotehosting.sh && cd <%= remotehosting.remotePath %> && <%= remotehosting.remotePath %>/prepare_remotehosting.sh <%= remotehosting.environment %> ',
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
            }
        }

        grunt.config.set('sshexec', sshexecOptions);

        /* prepare the SfTP Exec options */
        sftpOptions = {
            prepare_remotehosting_sh: {
                files: {
                    "./": "deploy/prepare_remotehosting.sh"
                },
                options: {
                    srcBasePath: 'deploy',
                    path: '<%= remotehosting.remotePath %>',
                    host: '<%= remotehosting.ssh.hostname %>',
                    username: '<%= remotehosting.ssh.username %>',
                    password: '<%= remotehosting.ssh.password %>',
                    privateKey: '<%= remotehosting.ssh.privateKey %>',
                    showProgress: true
                },
            },
        };

        grunt.config.set('sftp', sftpOptions);

        /* Task sequence to run */
        grunt.task.run('rsync:remotehosting_build_local');

        if (jsonConfig.maintenanceEnabled) {
            grunt.task.run('sshexec:run_artisan_down');
        }

        grunt.task.run('rsync:remotehosting_remote_rsync');

        grunt.task.run('sftp:prepare_remotehosting_sh');
        grunt.task.run('sshexec:run_prepare_remotehosting_sh');
        grunt.task.run('sshexec:remove_prepare_remotehosting_sh');

        if (jsonConfig.maintenanceEnabled) {
            grunt.task.run('sshexec:run_artisan_up');
        }

    });

}
