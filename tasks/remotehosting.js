module.exports = function(grunt) {

  grunt.loadTasks(__dirname + "/../node_modules/grunt-rsync/tasks")
  grunt.loadTasks(__dirname + "/../node_modules/grunt-ssh/tasks")
  grunt.loadTasks(__dirname + "/../node_modules/grunt-template/tasks");

  grunt.registerTask('remotehosting', 'Deploy to remotehosting', function(n) {
    var remotehostingConfig = grunt.option('remotehosting-config');

    /* check if a remotehosting config file has been passed */
    if (remotehostingConfig === undefined) {
      grunt.fail.fatal('you need to specify a --remotehosting-config option')
    } else {
      console.log(remotehostingConfig);
    }

    /* read the settings */
    var jsonConfig = grunt.file.readJSON(remotehostingConfig);

    /* read private key */
    var privateKeyFile=jsonConfig.ssh.privateKeyFile;
    var privateKey;
    if (privateKeyFile) {
      privateKey=grunt.file.read(privateKeyFile);
      jsonConfig.ssh.privateKey=privateKey;
    }

    /* read the settings */
    grunt.config.set('remotehosting',jsonConfig);

    // Create our build directory
    grunt.file.mkdir("remotehosting-build");

    /* prepare the RSYNC options */
    rsyncOptions = {
      options: {
        recursive: true
      },
      remotehosting_build_local: {
        options: {
          args: ["-avz","--super"],
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
          args: ["-vz","--super"],
          ssh: true,
          compareMode: 'checksum', // On remotehosting times don't get synched, so we use checksum
          src: "remotehosting-build/www/",
          syncDestIgnoreExcl: true, // Delete files on remote that don't exist local
          exclude: ["cache/"], // But don't remove these directories
          dest: "<%= remotehosting.remotePath %><%= remotehosting.deployFolder %>",
          host: "<%= remotehosting.ssh.username + '@' + remotehosting.ssh.hostname %>",
        }
      }
    }

    grunt.config.set('rsync',rsyncOptions);

    //grunt.config.set('template',templateOptions);

    /* prepare the SSH Exec options */
    sshexecOptions = {
      run_prepare_remotehosting_sh: {
        command: 'chmod +x '+'<%= remotehosting.remotePath %>/' + 'prepare_remotehosting.sh && '+'<%= remotehosting.remotePath %>'+'/prepare_remotehosting.sh',
        options: {
          host: '<%= remotehosting.ssh.hostname %>',
          username: '<%= remotehosting.ssh.username %>',
          password: '<%= remotehosting.ssh.password %>',
          privateKey: '<%= remotehosting.ssh.privateKey %>'
        }
      },
      remove_prepare_remotehosting_sh: {
        command: 'rm '+ '<%= remotehosting.remotePath %>/' + './prepare_remotehosting.sh',
        options: {
          host: '<%= remotehosting.ssh.hostname %>',
          username: '<%= remotehosting.ssh.username %>',
          password: '<%= remotehosting.ssh.password %>',
          privateKey: '<%= remotehosting.ssh.privateKey %>'
        }
      }
    }

    grunt.config.set('sshexec',sshexecOptions);

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

    grunt.config.set('sftp',sftpOptions);

    /* Task sequence to run */
    grunt.task.run('rsync:remotehosting_build_local');

    grunt.task.run('rsync:remotehosting_remote_rsync');

    grunt.task.run('sftp:prepare_remotehosting_sh');
    grunt.task.run('sshexec:run_prepare_remotehosting_sh');
    grunt.task.run('sshexec:remove_prepare_remotehosting_sh');

  });

}
