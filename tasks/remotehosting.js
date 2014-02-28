module.exports = function(grunt) {

  grunt.loadNpmTasks('grunt-rsync');
  grunt.loadNpmTasks('grunt-ssh');
  grunt.loadNpmTasks('grunt-template');

  grunt.registerTask('remotehosting', 'Deploy to remotehosting', function(n) {
    var remotehostingConfig = grunt.option('remotehosting-config');

    /* check if a remotehosting config file has been passed */
    if (remotehostingConfig === undefined) {
      grunt.fail.fatal('you need to specify a --remotehosting-config option')
    } else {
      console.log(remotehostingConfig);
    }

    /* read the settings */
    grunt.config.set('remotehosting',grunt.file.readJSON(remotehostingConfig));

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
          dest: "<%= remotehosting.remotePath %>/www",
          host: "<%= remotehosting.ssh.username + '@' + remotehosting.ssh.hostname %>",
        }
      }
    }

    grunt.config.set('rsync',rsyncOptions);

    //grunt.config.set('template',templateOptions);

    /* prepare the SSH Exec options */
    sshexecOptions = {
      run_prepare_remotehosting_sh: {
        command: 'chmod +x prepare_remotehosting.sh && ./prepare_remotehosting.sh',
        options: {
          host: '<%= remotehosting.ssh.hostname %>',
          username: '<%= remotehosting.ssh.username %>',
          password: '<%= remotehosting.ssh.password %>'
        }
      },
      remove_prepare_remotehosting_sh: {
        command: 'rm ./prepare_remotehosting.sh',
        options: {
          host: '<%= remotehosting.ssh.hostname %>',
          username: '<%= remotehosting.ssh.username %>',
          password: '<%= remotehosting.ssh.password %>'
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
