// --------------------------------------------------------------------------------------------------------------------
// <copyright file="ClientController.cs" company="Exit Games GmbH">
//   Copyright (c) Exit Games GmbH.  All rights reserved.
// </copyright>
// <summary>
//   Defines the ClientController type.
// </summary>
// --------------------------------------------------------------------------------------------------------------------

namespace ExitGames.Web.Sample.Controllers
{
    using System.Web.Http;

    using ExitGames.Web.Sample.Models;
    using ExitGames.Web.Sample.Services;

    // TODO be sure to use SSL in production
    //[RequireHttps]
    public class ClientController : ApiController
    {
        public ClientController()
            : this(null)
        {
        }

        public ClientController(IClientAuthenticationService authenticationService)
        {
            this.AuthenticationService = authenticationService ?? new ClientAuthenticationService();
        }

        public IClientAuthenticationService AuthenticationService { get; private set; }

        [AcceptVerbs("GET")]
        public Result Authenticate(string userName, string token)
        {
            if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(token))
            {
                var resultErrorInput = new Result { ResultCode = 3, Message = "Parameter invalid" };
                return resultErrorInput;
            }

            bool authenticated = this.AuthenticationService.Authenticate(userName, token);
            if (authenticated)
            {
                // authentication ok
                var resultOk = new Result { ResultCode = 1 };
                return resultOk;
            }

            // authentication failed
            var resultError = new Result
            {
                ResultCode = 2,
                ////Message = "whatever reason" // optional
            };
            return resultError;
        }
    }
}
